import * as httpRequest from "request-promise-native";
import {DialogflowApp} from "actions-on-google";
import * as functions from "firebase-functions";
import * as http from "http";

process.env.DEBUG = "actions-on-google:*";

exports.evapCoolingGroup = {
    assistant: functions.https.onRequest(assistantHandler),
    website: functions.https.onRequest(websiteHandler)
};

const bomBaseUrl = "http://www.bom.gov.au";
const moorabinUri = "/fwo/IDV60901/IDV60901.94870.json";

//const scoresbyUri = "/fwo/IDV60901/IDV60901.95867.json";

function assistantHandler(request: any, response: any) {
    const app = new DialogflowApp({request, response});
    console.log("Request headers: " + JSON.stringify(request.headers));
    console.log("Request body: " + JSON.stringify(request.body));

    // The Entry point to all our actions
    const actionMap = new Map();
    actionMap.set("calcMinTemp", async () => {
        const weatherData = await getBomObservations();
        const wetBulb = await calculate(weatherData);
        app.tell("Expected evaporative cooling air temperature is "
            + wetBulb.toFixed(1) + " degrees based on outside temp of "
            + weatherData.airTemp.toFixed(1) + " and humidity of " + weatherData.relativeHumidity.toFixed(1));
    });
    actionMap.set("input.welcome", helloWorld);
    actionMap.set("input.unknown", helloWorld);

    app.handleRequest(actionMap);
}

async function websiteHandler(request: any, response: any) {
    const weatherData: WeatherData = await getBomObservations();
    const airTemp: number = request.body.temp ? parseFloat(request.body.temp) : weatherData.airTemp;
    const relativeHumidity: number = request.body.hum ? parseFloat(request.body.hum) : weatherData.relativeHumidity;
    const airPressure: number = weatherData.airPressure;

    const wetBulb: number = await calculate({airTemp, relativeHumidity, airPressure});

    response.status(200).send("<html><body>" +
        "<div>" +
        "<h1>" + wetBulb.toFixed(1) + "</h1>" +
        " (based on outside temp of " + airTemp.toFixed(1) + " and humidity of " + relativeHumidity.toFixed(1) + ")" +
        "</div>" +
        "<form method='post'>" +
        "<div>" +
        "<label for='temp'>Temperature:</label>" +
        "<input type='text' id='temp' name='temp'>" +
        "</div>" +
        "<div>" +
        "<label for='hum'>Humidity:</label>" +
        "<input type='text' id='hum' name='hum'>" +
        "</div>" +
        "<div class='button'>" +
        "<button type='submit'>Calculate with these values</button>" +
        "</div>" +
        "</form></body></html>");
}

function helloWorld(app: any) {
    app.tell("Hello, World!");
}

async function getBomObservations(uri?: string): Promise<WeatherData> {
    const bomRequest = httpRequest.defaults({
        baseUrl: bomBaseUrl,
        agent: new http.Agent()
    });

    const moorabinResponse = await bomRequest.get({uri: uri == null ? moorabinUri : uri});

    const json = JSON.parse(moorabinResponse);
    const datum = json.observations.data[0];
    const airTemp = datum.air_temp;
    const relativeHumidity = parseFloat(datum.rel_hum);
    const airPressure = datum.press_msl;
    return {airTemp, relativeHumidity, airPressure};
}

async function calculate(weatherData: WeatherData): Promise<number> {

    const evapCoolingEfficiency = 0.6;

    const wetBulbTemp = calculateWetBulb(weatherData.airTemp, weatherData.relativeHumidity, weatherData.airPressure);
    const airTempToWetBulbDelta = weatherData.airTemp - wetBulbTemp;
    const maxEvapCoolingTempDrop = airTempToWetBulbDelta * evapCoolingEfficiency;
    const minPossTemp = weatherData.airTemp - maxEvapCoolingTempDrop;

    return minPossTemp;
}

//Code from http://www.crh.noaa.gov/epz/?n=wxcalc_rh (refactored heavily)

function calculateWetBulb(tempC: any, rh: number, pressureMB: any) {

    // noinspection MagicNumberJS
    const saturatedVaporPressure = 6.112 * Math.exp(17.67 * tempC / (tempC + 243.5));
    // noinspection MagicNumberJS
    const actualVaporPressure = saturatedVaporPressure * (rh / 100);

    return calcwetbulb(tempC, pressureMB, actualVaporPressure);
}

function calcwetbulb(tempC: any, pressureMB: any, actualVaporPressure: any) {
    let wbGuess = 0;
    let incr = 10;
    let previoussign = 1;
    let vaporPressureDifference = 1;

    // noinspection MagicNumberJS
    while (Math.abs(vaporPressureDifference) > 0.05) {
        // noinspection MagicNumberJS
        const guessSaturatedVaporPressure = 6.112 * Math.exp((17.67 * wbGuess) / (wbGuess + 243.5));
        // noinspection MagicNumberJS
        const guessActualVaporPressure = guessSaturatedVaporPressure - pressureMB * (tempC - wbGuess) * 0.00066 * (1 + (0.00115 * wbGuess));
        vaporPressureDifference = actualVaporPressure - guessActualVaporPressure;

        if (vaporPressureDifference === 0) {
            break;
        } else {
            if (vaporPressureDifference < 0) {
                reverseDirectionIfNeeded(-1);
            } else {
                reverseDirectionIfNeeded(1);
            }
        }

        wbGuess += incr * previoussign;
    }

    return wbGuess;

    function reverseDirectionIfNeeded(cursign: any) {
        if (cursign !== previoussign) {
            //Overshoot - reverse direction and decrease step size
            previoussign = cursign;
            incr /= 10;
        }
    }
}
