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

        hook.res.end(minPossTemp);
    })
};

function calculateWetBulb(Ctemp, rh, MBpressure)
{
    rh = parseFloat(rh);

    var Es = parseFloat(esubs(Ctemp));


    E2 = parseFloat(invertedRH(Es,rh));
    Twguess = 0;
    incr = 10;
    previoussign = 1;
    Edifference = 1;

    return roundOff(calcwetbulb(Edifference,Twguess,Ctemp,MBpressure,E2,previoussign,incr));
};

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

function calcwetbulb(Edifference,Twguess,Ctemp,MBpressure,E2,previoussign,incr)
{
    outerloop:
        while (Math.abs(Edifference) > 0.05)
        {
            Ewguess = 6.112 * Math.exp((17.67 * Twguess) / (Twguess + 243.5));
            Eguess = Ewguess - MBpressure * (Ctemp - Twguess) * 0.00066 * (1 + (0.00115 * Twguess));
            Edifference = E2 - Eguess;

            if (Edifference == 0)
            {
                break outerloop;
            } else {
                if (Edifference < 0)
                {
                    cursign = -1;
                    if (cursign != previoussign)
                    {
                        previoussign = cursign;
                        incr = incr/10;
                    } else {
                        incr = incr;
                    }
                } else {
                    cursign = 1;
                    if (cursign != previoussign)
                    {
                        previoussign = cursign;
                        incr = incr/10;
                    } else {
                        incr = incr;
                    }
                }
            }

            Twguess = Twguess + incr * previoussign;

        }
    wetbulb = Twguess;
    return wetbulb;
}

function roundOff(value)
{
    value = Math.round(100*value)/100;
    return value;
}