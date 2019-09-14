/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const { wrap } = require("@adobe/helix-status");
const git = require("isomorphic-git");
const fs = require("fs");
const path = require("path");
const os = require("os");
const algoliasearch = require("algoliasearch");
const $ = require("shelljs");

/**
 * This is the main function
 * @param {string} name name of the person to greet
 * @returns {object} a greeting
 */
async function main({
  repo,
  owner,
  ALGOLIA_APP_ID,
  ALGOLIA_API_KEY,
  depth = 100,
  shard = 0,
  shards = 1,
  existing
} = {}) {
  let dir;
  if (existing) {
    dir = existing;
    console.log("using existing checkout", existing);
  } else {
    // Make temporary directory
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "test-"));
    console.log("cloning into", dir);

    await git.clone({
      fs,
      dir,
      url: `https://github.com/${owner}/${repo}.git`,
      depth
    });

    console.log("clone completed");
    // Now it should not be empty...
  }

  $.cd(dir);
  const log = $.exec('git log --pretty="format:%H"', {
    async: true,
    silent: true
  });

  const docs = {};
  const jobs = [];

  const adddoc = (p, h, c) => {
    const key = p + "-" + h;
    if (!docs[key]) {
      docs[key] = {
        refs: [],
        path: "/" + p,
        name: path.basename(p),
        dir: path.dirname(p),
        type: path.extname(p),
        objectID: key
      };
    }
    //console.log(c.split('\n'));
    docs[key].refs.push(c);
  };

  jobs.push(
    new Promise(logresolve => {
      log.stdout.on("end", logresolve);
      log.stdout.on("data", commits => {
        commits.split("\n").map(commit => {
          const processline = line => {
            if (!line) {
              return;
            }
            const [info, path] = line.split("\t");
            const [mode, type, hash] = info.split(" ");
            if (type !== "blob") {
              return;
            }
            if (!path.match(/\.md$/)) {
              return;
            }
            if (
              parseInt(hash.substr(0, 5), 16) % parseInt(shards, 10) !==
              parseInt(shard, 10)
            ) {
              // enable parallel processing
              //console.log('dicarding shard', parseInt(A.oid.substr(0, 5), 16));
              return;
            }
            adddoc(path, hash, commit);
          };

          const ls = $.exec("git ls-tree --full-name -r " + commits, {
            async: true,
            silent: true
          });
          let buf = "";
          jobs.push(
            new Promise(lsresolve => {
              ls.stdout.on("data", logline => {
                buf = buf + logline;
                const lines = buf.split("\n");
                if (lines.length > 1) {
                  buf = lines.pop();
                  lines.map(processline);
                }
              });

              ls.stdout.on("end", () => {
                buf.split("\n").map(processline);
                lsresolve(true);
              });
            })
          );
        });
      });
    })
  );

  await Promise.all(jobs);
  await Promise.all(jobs);

  console.log("todo:", jobs.length);
  await Promise.all(jobs);
  //console.log(docs);

  console.log("uploading index");
  const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
  const index = client.initIndex(`${owner}--${repo}`);

  index.setSettings({
    attributesForFaceting: ["refs", "filterOnly(path)", "type"]
  });

  return index.saveObjects(Object.values(docs));
}

module.exports = { main: wrap(main) };
