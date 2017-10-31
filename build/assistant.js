"use strict";
const request = require("request");
const actions_on_google_1 = require("actions-on-google");
// Some variables we will use in this example
const ACTION_PRICE = "calcMinTemp";
function simpleHttpRequest(assistant) {
    request.get("http://www.bom.gov.au/fwo/IDV60901/IDV60901.94870.json", (err, res, body) => {
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
        assistant.tell("The coldest the air coming out of the evaporative cooler could be at the moment is "
            + minPossTemp.toFixed(1) + " degrees");
    });
}
//Common code
function calculateWetBulb(Ctemp, rh, MBpressure) {
    const rhFloat = parseFloat(rh);
    const Es = esubs(Ctemp);
    const E2 = invertedRH(Es, rhFloat);
    return calcwetbulb(Ctemp, MBpressure, E2);
}
function esubs(Ctemp) {
    const Es = 6.112 * Math.exp(17.67 * Ctemp / (Ctemp + 243.5));
    return Es;
}
function invertedRH(Es, rh) {
    const E = Es * (rh / 100);
    return E;
}
function calcwetbulb(Ctemp, MBpressure, E2) {
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
        }
        else {
            if (Edifference < 0) {
                reverseDirectionIfNeeded(-1);
            }
            else {
                reverseDirectionIfNeeded(1);
            }
        }
        Twguess = Twguess + incr * previoussign;
    }
    return Twguess;
    function reverseDirectionIfNeeded(cursign) {
        if (cursign !== previoussign) {
            //Overshoot - reverse direction and decrease step size
            previoussign = cursign;
            incr /= 10;
        }
    }
}
module.exports = function getTemp(hook) {
    const assistant = new actions_on_google_1.DialogflowApp({ request: hook.req, response: hook.res });
    // The Entry point to all our actions
    const actionMap = new Map();
    actionMap.set(ACTION_PRICE, simpleHttpRequest);
    assistant.handleRequest(actionMap);
};
