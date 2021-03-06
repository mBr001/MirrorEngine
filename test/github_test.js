// --------------------------------------------------------------------------------------------- //

// MIT License
//
// Copyright (c) 2018 Hugo Xu
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.

// --------------------------------------------------------------------------------------------- //

// GitHub API utility test
//
// Put this content to a file on GitHub: "abcd\n"

// --------------------------------------------------------------------------------------------- //

"use strict";

// --------------------------------------------------------------------------------------------- //

const os = require("os");
const path = require("path");

const { Assert, Log } = require("./common");
const { ConfigLoad } = require("../dist/config");
const { GitHub } = require("../dist/github");

// --------------------------------------------------------------------------------------------- //

const REPO = "TestRepo";
const PATH = "GitHubApiTestFile.txt";
const SHA_EXPECTED = "acbe86c7c89586e0912a0a851bacf309c595c308";

// --------------------------------------------------------------------------------------------- //

const TestMain = async () => {

    // ----------------------------------------------------------------------------------------- //

    const config = await ConfigLoad(path.resolve(os.homedir(), "mirror-engine-config.json"));
    const github = new GitHub(config.User, config.Secret);

    // ----------------------------------------------------------------------------------------- //

    Log("Test finding sha of a file");
    const data = await github.BlobSha({
        Repo: REPO,
        Path: PATH,
    });
    Assert(typeof data.Sha === "string" && data.Sha === SHA_EXPECTED);
    Log("Test passed");

    // ----------------------------------------------------------------------------------------- //

};

TestMain();

// --------------------------------------------------------------------------------------------- //
