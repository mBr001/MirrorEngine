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

// Network request utility

// --------------------------------------------------------------------------------------------- //

"use strict";

// --------------------------------------------------------------------------------------------- //

import * as assert from "assert";
import * as http from "http";
import * as https from "https";
import * as stream from "stream";
import * as url from "url";
import * as zlib from "zlib";

import { LogDebug, LogMessage, LogError } from "./log";

// --------------------------------------------------------------------------------------------- //

const RESPONSE_MAX_SIZE: number = 16 * 1024 * 1024;

// --------------------------------------------------------------------------------------------- //

interface RequestHeaders {
    [key: string]: string,
}

export enum RequestHeadersCustomizable {
    Accept = "Accept",
    Authorization = "Authorization",
    UserAgent = "User-Agent",
}

// --------------------------------------------------------------------------------------------- //

enum RequestMethods {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
}

// --------------------------------------------------------------------------------------------- //

export interface RequestSleepTimer {
    Timer: (timeout: number) => Promise<void>,
    Timeout: number,
}

export interface RequestRequest {
    Payload?: string | Buffer,
    Timer?: RequestSleepTimer, // Required if Retry is true

    ErrorSuppress?: boolean,
    Stubborn?: boolean, // Get response text even if response code is not in the 200 range

    Retry?: boolean,
}

export interface RequestResponse {
    RedirectRefused?: boolean,

    Stream?: http.IncomingMessage,
    Text?: string,
}

// --------------------------------------------------------------------------------------------- //

const RequestHeadersDefault: RequestHeaders = {
    "Cache-Control": "no-cache",
    "Accept": "text/plain, text/*, */*;q=0.9",
    "Accept-Encoding": "deflate, gzip, identity",
};

// --------------------------------------------------------------------------------------------- //

const RequestRedirectStatusCode: Set<number> = new Set<number>([
    301,
    302,
    307,
]);

const RequestRedirectSafeAbsoluteLink: RegExp = /^https:\/\/(?:\w+\.)+\w+\//;

const RequestRedirectSafeRelativeLink: RegExp = /^\/\w/;

// --------------------------------------------------------------------------------------------- //

export class RequestEngine {

    // ----------------------------------------------------------------------------------------- //

    // TODO: Not used for now

    private PendingRequestsCount: number = 0;

    public PendingRequestsCountGet(): number {
        return this.PendingRequestsCount;
    }

    // ----------------------------------------------------------------------------------------- //

    private HeadersCustom: RequestHeaders = {};

    public HeadersCustomSet(key: RequestHeadersCustomizable, val: string): void {
        this.HeadersCustom[key] = val;
    }

    // ----------------------------------------------------------------------------------------- //

    private static StreamToHeader(
        res: http.IncomingMessage,
        key: string,
        def: string = "",
    ): string {

        const header: string | undefined | string[] = res.headers[key];

        if (typeof header === "undefined")
            return def;

        if (Array.isArray(header))
            return header.join(", ");
        else
            return header;

    }

    private static StreamToText(res: http.IncomingMessage): Promise<string> {
        return new Promise<string>((
            resolve: (txt: string) => void,
            reject: (err: Error) => void,
        ): void => {

            // --------------------------------------------------------------------------------- //

            let s: stream.Readable;
            const encoding: string = RequestEngine.StreamToHeader(
                res,
                "content-encoding",
                "identity",
            );

            switch (encoding) {
                case "identity":
                    s = res;
                    break;

                case "gzip":
                    s = res.pipe(zlib.createGunzip());
                    break;

                case "deflate":
                    s = res.pipe(zlib.createInflate());
                    break;

                default:
                    reject(new Error("Request Error: Unknown encoding '" + encoding + "'"));
                    return;
            }

            // --------------------------------------------------------------------------------- //

            let aborted: boolean = false;
            let data: string = "";

            // TODO: Properly handle text encoding
            s.setEncoding("utf8");

            s.on("data", (c: string): void => {
                if (aborted)
                    return;

                data += c;
                if (data.length > RESPONSE_MAX_SIZE) {
                    aborted = true;
                    data = "";

                    reject(new Error("Request Error: Response payload too large"));
                }
            });

            s.on("end", (): void => {
                if (aborted)
                    return;

                resolve(data);
            });

            s.on("error", (err: Error): void => {
                if (aborted)
                    return;

                aborted = true;
                data = "";

                reject(err);
            });

            // --------------------------------------------------------------------------------- //

        });
    }

    // ----------------------------------------------------------------------------------------- //

    private LinkToStream(
        link: string,
        method: RequestMethods,
        opt: RequestRequest,
    ): Promise<http.IncomingMessage> {
        return new Promise<http.IncomingMessage>((
            resolve: (res: http.IncomingMessage) => void,
            reject: (err: Error) => void,
        ): void => {

            // --------------------------------------------------------------------------------- //

            LogMessage(method + " - " + link);

            const headers: string[] = Object.keys(this.HeadersCustom);
            if (headers.length > 0)
                LogDebug("Sending custom headers: '" + headers.join("', '") + "'");

            // --------------------------------------------------------------------------------- //

            const option: http.RequestOptions = url.parse(link);
            option.headers = Object.assign({}, RequestHeadersDefault, this.HeadersCustom);
            option.method = method;

            if (option.protocol !== "https:") {
                return void reject(
                    new Error("Request Error: Unknown protocol '" + option.protocol + "'"),
                );
            }

            // --------------------------------------------------------------------------------- //

            const req: http.ClientRequest = https.request(option);
            req.on("response", resolve);
            req.on("error", reject);

            if (typeof opt.Payload === "undefined")
                req.end();
            else
                req.end(opt.Payload);

            // --------------------------------------------------------------------------------- //

        });
    }

    private async LinkToResponse(
        link: string,
        method: RequestMethods,
        opt?: RequestRequest,
    ): Promise<RequestResponse> {

        if (typeof opt === "undefined")
            opt = {};

        const log = (msg: string): void => {
            if (opt!.ErrorSuppress || opt!.Retry)
                LogDebug(msg);
            else
                LogError(msg);
        };

        let res: http.IncomingMessage | undefined;
        let redirect: number = 5;

        while (redirect-- > 0) {

            // --------------------------------------------------------------------------------- //

            try {
                res = await this.LinkToStream(link, method, opt);
            } catch (err) {
                log((<Error>err).message);
                return {};
            }

            // --------------------------------------------------------------------------------- //

            if (RequestRedirectStatusCode.has(<number>res.statusCode)) {
                const location: string = RequestEngine.StreamToHeader(res, "location");

                if (RequestRedirectSafeAbsoluteLink.test(location)) {
                    res.resume();
                    link = location;
                    continue;
                }

                if (RequestRedirectSafeRelativeLink.test(location)) {
                    res.resume();
                    link = "https://" + url.parse(link).hostname + location;
                    continue;
                }

                log("Request Error: Invalid redirect link '" + location + "'");
                return {
                    RedirectRefused: true,
                    Stream: res,
                };
            }

            if (!opt.Stubborn && (<number>res.statusCode < 200 || <number>res.statusCode > 299)) {
                log("Request Error: Unexpected status code '" + res.statusCode + "'");
                return { Stream: res };
            }

            // --------------------------------------------------------------------------------- //

            let txt: string;
            try {
                txt = await RequestEngine.StreamToText(res);
            } catch (err) {
                log((<Error>err).message);
                return { Stream: res };
            }

            return {
                Stream: res,
                Text: txt,
            };

            // --------------------------------------------------------------------------------- //

        }

        log("Request Error: Too many redirects");
        return {
            RedirectRefused: true,
            Stream: res,
        };

    }

    // ----------------------------------------------------------------------------------------- //

    private async RequestRetryHandle(
        link: string,
        method: RequestMethods,
        opt?: RequestRequest,
    ): Promise<RequestResponse> {
        this.PendingRequestsCount++;

        let result: RequestResponse = await this.LinkToResponse(link, method, opt);

        if (typeof result.Text === "undefined" && typeof opt !== "undefined" && opt.Retry) {
            assert(typeof opt.Timer !== "undefined");

            opt.Retry = false;
            await opt.Timer!.Timer(opt.Timer!.Timeout);
            result = await this.LinkToResponse(link, method, opt);
        }

        this.PendingRequestsCount--;

        return result;
    }

    // ----------------------------------------------------------------------------------------- //

    public async Get(link: string, opt?: RequestRequest): Promise<RequestResponse> {
        return await this.RequestRetryHandle(link, RequestMethods.GET, opt);
    }

    // ----------------------------------------------------------------------------------------- //

    private static BindPayload(payload: string | Object, opt?: RequestRequest): RequestRequest {
        if (typeof payload !== "string")
            payload = JSON.stringify(payload);

        if (typeof opt === "undefined")
            opt = {};

        assert(typeof opt.Payload === "undefined");
        opt.Payload = <string>payload;

        return opt;
    }

    public async Post(
        link: string,
        payload: string | Object,
        opt?: RequestRequest,
    ): Promise<RequestResponse> {

        opt = RequestEngine.BindPayload(payload, opt);
        return await this.RequestRetryHandle(link, RequestMethods.POST, opt);

    }

    public async Put(
        link: string,
        payload: string | Object,
        opt?: RequestRequest,
    ): Promise<RequestResponse> {

        opt = RequestEngine.BindPayload(payload, opt);
        return await this.RequestRetryHandle(link, RequestMethods.PUT, opt);

    }

    // ----------------------------------------------------------------------------------------- //

}

// --------------------------------------------------------------------------------------------- //
