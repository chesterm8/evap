import * as request from 'request';

export function simpleHttpRequest (hook:any) {
    // npm modules available, see: http://hook.io/modules
    request.get('http://httpbin.org/ip', function(err, res, body){
        if (err) {
            return hook.res.end(err.messsage);
        }
        hook.res.end(body);
    })
};