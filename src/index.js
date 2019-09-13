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
const algoliasearch = require('algoliasearch');

/**
 * This is the main function
 * @param {string} name name of the person to greet
 * @returns {object} a greeting
 */
async function main({ name = "world", repo, owner, ALGOLIA_APP_ID, ALGOLIA_API_KEY } = {}) {
  // Make temporary directory
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "test-"));
  console.log("cloning into", dir);

  await git.clone({
    fs,
    dir,
    url: `https://github.com/${owner}/${repo}.git`
  });

  // Now it should not be empty...

  const commits = await git.log({ fs, dir });

  const docs = {};

  const jobs = commits.map(async commit => {
    const job = git.walkBeta1({
      trees: [git.TREE({ dir, fs, ref: commit.oid })],
      map: async function([A]) {
        // ignore directories
        if (A.fullpath === ".") {
          return;
        }
        await A.populateStat();
        if (A.type === "tree") {
          return;
        }

        // generate ids
        await A.populateHash();

        if (!A.fullpath.match(/\.md$/)) {
          return;
        }

        if (!docs[A.fullpath + '-' + A.oid]) {
          docs[A.fullpath + '-' + A.oid] = {
            refs: [],
            path: A.fullpath,
            objectID: A.fullpath + '-' + A.oid
          };

          A.populateContent().then(() => {
            docs[A.fullpath + '-' + A.oid].content = A.content.toString().slice(0, 1024);
          });
        }

        docs[A.fullpath + '-' + A.oid].refs.push(commit.oid);
      }
    });
    return job;
  });

  await Promise.all(jobs);
  console.log(docs);

  const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
  const index = client.initIndex(`${owner}--${repo}`);

  return index.saveObjects(Object.values(docs));
}

module.exports = { main: wrap(main) };
