module['exports'] = function simpleHttpRequest (hook) {
    var request = require('request');
    request.get('http://www.bom.gov.au/fwo/IDV60901/IDV60901.94870.json', function(err, res, body){
        if (err) {
            return hook.res.end(err.messsage);
        }
        var json = JSON.parse(body);
        var datum = json.observations.data[0];
        var airTemp = datum.air_temp;
        var relativeHumidity = datum.rel_hum;
        var airPressure = datum.press_msl;
        var evapCoolingEfficiency = 0.7;

        var wetBulb = calculateWetBulb(airTemp, relativeHumidity, airPressure);
        var airTempToWetBulbDelta = airTemp - wetBulb;
        var maxEvapCoolingTempDrop = airTempToWetBulbDelta * evapCoolingEfficiency;
        var minPossTemp = airTemp - maxEvapCoolingTempDrop;

        hook.res.end("<html><body><h1>"+minPossTemp.toFixed(1)+"</h1></body></html>");
    })
};

function calculateWetBulb(Ctemp, rh, MBpressure)
{
    var rhFloat = parseFloat(rh);

    var Es = parseFloat(esubs(Ctemp));

    var E2 = parseFloat(invertedRH(Es, rhFloat));

    return calcwetbulb(Ctemp,MBpressure,E2);
}

function esubs(Ctemp)
{
    var Es;
    Es = 6.112 * Math.exp(17.67 * Ctemp / (Ctemp + 243.5));
    return Es;
}

function invertedRH(Es,rh)
{
    var E;
    E = Es * (rh/100);
    return E;
}

function calcwetbulb(Ctemp,MBpressure,E2)
{
    var Twguess = 0;
    var incr = 10;
    var previoussign = 1;
    var Edifference = 1;

    while (Math.abs(Edifference) > 0.05) {
        var Ewguess = 6.112 * Math.exp((17.67 * Twguess) / (Twguess + 243.5));
        var Eguess = Ewguess - MBpressure * (Ctemp - Twguess) * 0.00066 * (1 + (0.00115 * Twguess));
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

    function reverseDirectionIfNeeded(cursign) {
        if (cursign !== previoussign) {
            //Overshoot - reverse direction and decrease step size
            previoussign = cursign;
            incr /= 10;
        }
    }
}