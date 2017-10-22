"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("request");
function simpleHttpRequest(hook) {
    // npm modules available, see: http://hook.io/modules
    request.get('http://httpbin.org/ip', function (err, res, body) {
        if (err) {
            return hook.res.end(err.messsage);
        }
        hook.res.end(body);
    });
}
exports.simpleHttpRequest = simpleHttpRequest;
;
//# sourceMappingURL=index.js.map