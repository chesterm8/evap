import * as httpRequest from "request";
import {DialogflowApp} from "actions-on-google";
import * as functions from "firebase-functions";

process.env.DEBUG = "actions-on-google:*";

exports.evapCoolingGroup = {
    assistant: functions.https.onRequest(assistantHandler),
    website: functions.https.onRequest(websiteHandler)
};

function assistantHandler(request: any, response: any) {
    const app = new DialogflowApp({request, response});
    console.log("Request headers: " + JSON.stringify(request.headers));
    console.log("Request body: " + JSON.stringify(request.body));

    // The Entry point to all our actions
    const actionMap = new Map();
    actionMap.set("calcMinTemp", async () => {
        const wetBulb: WetBulb = await wetBulbFromMoorabbin();
        app.tell("Expected evaporative cooling air temperature is "
            + wetBulb.minCoolingTemp.toFixed(1) + " degrees");
    });
    actionMap.set("input.welcome", helloWorld);
    actionMap.set("input.unknown", helloWorld);

    app.handleRequest(actionMap);
}

async function websiteHandler(request: any, response: any) {
    const wetBulb = await wetBulbFromMoorabbin();
    response.status(200).send("<html><body><h1>" + wetBulb.minCoolingTemp.toFixed(1)
        + "</h1> (based on outside temp of " + wetBulb.outsideTemp.toFixed(1) + ")</body></html>");
}

function helloWorld(app: any) {
    app.tell("Hello, World!");
}

async function wetBulbFromMoorabbin(): Promise<WetBulb> {
    return new Promise<WetBulb>((resolve, reject) => {
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

            resolve({minCoolingTemp: minPossTemp, outsideTemp: airTemp});
        });
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
    return 6.112 * Math.exp(17.67 * Ctemp / (Ctemp + 243.5));
}

function invertedRH(Es: any, rh: any) {
    return Es * (rh / 100);
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

        Twguess += incr * previoussign;
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
