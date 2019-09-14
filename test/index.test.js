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

/* eslint-env mocha */

"use strict";

const assert = require("assert");
const index = require("../src/index.js").main;

describe("Index Tests", () => {
  it("index checks clones a repository", async () => {
    const shard1 = index({
      owner: "adobe",
      repo: "helix-home",
      ALGOLIA_APP_ID: process.env.ALGOLIA_APP_ID,
      ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
      depth: 10,
      shard: 0,
      shards: 2
    });

    const shard2 = index({
      owner: "adobe",
      repo: "helix-home",
      ALGOLIA_APP_ID: process.env.ALGOLIA_APP_ID,
      ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
      depth: 10,
      shard: 1,
      shards: 2
    });

    const all = index({
      owner: "adobe",
      repo: "helix-home",
      ALGOLIA_APP_ID: process.env.ALGOLIA_APP_ID,
      ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
      depth: 10,
      shard: 0,
      shards: 1
    });

    await shard1;
    await shard2;
    await all;
    console.log((await shard1).objectIDs, (await shard2).objectIDs, (await all).objectIDs);
    assert.equal((await shard1).objectIDs.length + (await shard2).objectIDs.length, (await all).objectIDs.length);
  }).timeout(100000);

  it.only("index checks clones a large repository", async () => {
    const shard1 = index({
      owner: "gatsbyjs",
      repo: "gatsby",
      ALGOLIA_APP_ID: process.env.ALGOLIA_APP_ID,
      ALGOLIA_API_KEY: process.env.ALGOLIA_API_KEY,
      depth: 1,
      shard: 0,
      shards: 100,
      existing: '/tmp/gatsby'
    });

    console.log((await shard1).objectIDs);
  }).timeout(10000000);
});
