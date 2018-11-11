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

// Filter validator

// --------------------------------------------------------------------------------------------- //

"use strict";

// --------------------------------------------------------------------------------------------- //

import { LogError } from "./log";

// --------------------------------------------------------------------------------------------- //

const ValidatePureAlphanumeric: RegExp = /^[a-zA-Z0-9]*$/;

const ValidateRuleWhitelist: Set<string> = new Set<string>([
]);

// --------------------------------------------------------------------------------------------- //

export const ValidateFilter = (data: string): boolean => {
    data = data.trim();

    if (data.startsWith("<")) {
        LogError("Integrity Guard: A filter should not begin with '<'");
        return false;
    }

    for (let f of data.split("\n")) {
        f = f.trim();

        if (f.length === 0)
            continue;

        if (f.length < 4 && ValidatePureAlphanumeric.test(f) && !ValidateRuleWhitelist.has(f)) {
            LogError("Integrity Guard: Rule '" + f + "' is flagged for manual review");
            return false;
        }
    }

    return true;
};

// --------------------------------------------------------------------------------------------- //