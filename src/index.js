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
/**
 * This is the main function
 * @param {string} name name of the person to greet
 * @returns {object} a greeting
 */
async function main({ name = "world", repo, owner } = {}) {
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
            path: A.fullpath
          };
        }
        docs[A.fullpath + '-' + A.oid].refs.push(commit.oid);
      }
    });
    return job;
  });

  await Promise.all(jobs);
  console.log(docs);

  return {
    body: `Hello, ${name}.`
  };
}

module.exports = { main: wrap(main) };
