import * as httpRequest from "request";
import {DialogflowApp} from "actions-on-google";
import * as functions from "firebase-functions";

process.env.DEBUG = "actions-on-google:*";

exports.evapCoolingGroup = {
    assistant: functions.https.onRequest(assistantHandler)//,
    //website: functions.https.onRequest(website)
};

function assistantHandler(request: any, response: any) {
    const app = new DialogflowApp({request, response});
    console.log("Request headers: " + JSON.stringify(request.headers));
    console.log("Request body: " + JSON.stringify(request.body));

    // The Entry point to all our actions
    const actionMap = new Map();
    actionMap.set("calcMinTemp", simpleHttpRequest);
    actionMap.set("input.welcome", helloWorld);

    app.handleRequest(actionMap);
}

function helloWorld(app: any) {
    app.tell("Hello, World!");
}

function simpleHttpRequest(app: any) {
    httpRequest.get("http://www.bom.gov.au/fwo/IDV60901/IDV60901.94870.json", (err, res, body) => {
        const json = JSON.parse(body);
        const datum = json.observations.data[0];
        const airTemp = datum.air_temp;
        const relativeHumidity = datum.rel_hum;
        const airPressure = datum.press_msl;
        const evapCoolingEfficiency = 0.7;

        const wetBulb = calculateWetBulb(airTemp, relativeHumidity, airPressure);
        const airTempToWetBulbDelta = airTemp - wetBulb;
        const maxEvapCoolingTempDrop = airTempToWetBulbDelta * evapCoolingEfficiency;
        const minPossTemp = airTemp - maxEvapCoolingTempDrop;

        app.tell("The coldest the air coming out of the evaporative cooler could be at the moment is "
            + minPossTemp.toFixed(1) + " degrees");
    });
}

//Common code

function calculateWetBulb(Ctemp: any, rh: any, MBpressure: any) {
    const rhFloat = parseFloat(rh);

    const Es = esubs(Ctemp);

    const E2 = invertedRH(Es, rhFloat);

    return calcwetbulb(Ctemp, MBpressure, E2);
}

function esubs(Ctemp: any) {
    const Es = 6.112 * Math.exp(17.67 * Ctemp / (Ctemp + 243.5));
    return Es;
}

function invertedRH(Es: any, rh: any) {
    const E = Es * (rh / 100);
    return E;
}

function calcwetbulb(Ctemp: any, MBpressure: any, E2: any) {
    let Twguess = 0;
    let incr = 10;
    let previoussign = 1;
    let Edifference = 1;

    while (Math.abs(Edifference) > 0.05) {
        const Ewguess = 6.112 * Math.exp((17.67 * Twguess) / (Twguess + 243.5));
        const Eguess = Ewguess - MBpressure * (Ctemp - Twguess) * 0.00066 * (1 + (0.00115 * Twguess));
        Edifference = E2 - Eguess;

        if (Edifference === 0) {
            break;
        } else {
            if (Edifference < 0) {
                reverseDirectionIfNeeded(-1);
            } else {
                reverseDirectionIfNeeded(1);
            }
        }

        Twguess = Twguess + incr * previoussign;
    }

    return Twguess;

    function reverseDirectionIfNeeded(cursign: any) {
        if (cursign !== previoussign) {
            //Overshoot - reverse direction and decrease step size
            previoussign = cursign;
            incr /= 10;
        }
    }
}
