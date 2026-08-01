/**
 * IEEE 754 Double Precision (64-bit) Rounding Module
 */
class RoundingMethod {

/*
    Input 1: dec/bin number
    Input 2: target # of digits
    Output: round using all methods
*/

    //check if dec or bin and then direct to apppropriate functions
    //decide whether to use static or function
    static roundAll(input, targetDigits, format) {

        //check if dec or bin
        //extract sign, main digit, and remainder

        //ex 12.15

        let sign = ""
        if (input[0] == "-"){
            sign = "-"
            input = input.slice(1) //remove negative sign for now
        }

        const pointIndex = input.indexOf(".");

         if (pointIndex === -1){
            //whole numbers 
        }

        const integerPart = input.slice(0,pointIndex)
        const fractionPart = input.slice(pointIndex+1)

        return {
            chopping: RoundingMethod.truncate(integerPart, fractionPart, targetDigits, sign),
            roundUp: RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign),
            roundDown: RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign),
            tiesToEven: RoundingMethod.rndToNearestTTE(integerPart, fractionPart, targetDigits, sign)
        };
    }



    static truncate(integerPart, fractionPart, targetDigits, sign) {
        // just chop values to target 
        let value = integerPart.concat(".", fractionPart)
        const cutLength = targetDigits + (value.includes(".") ? 1 : 0);
        value = value.slice(0,cutLength)
        return sign + value;
    }

    static rndUp(integerPart, fractionPart, targetDigits, sign) {
        // towards +positive infinity
        
        //ex -10.1281
        // truncate 4 = 10.12
        let value = integerPart.concat(".", fractionPart)
        const cutLength = targetDigits + (value.includes(".") ? 1 : 0);
        value = value.slice(0,cutLength)

        //let lastDiscarded = value[cutLength + 1] //gets last discarded bit

        if (sign == "-"){
            value = value.slice(0,cutLength)
        }else{
            let pntIndex = value.indexOf(".");
            let intPart = value.slice(0,pntIndex)
            let fracPart = value.slice(pntIndex+1)

            let fracPartUp = Number(fracPart)
            fracPartUp += 1
            value = intPart.concat(".", fracPartUp)
            
        }

        return sign + value

    }

    static rndDown(integerPart, fractionPart, targetDigits, sign){
        // towards -negative infinity

        let value = integerPart.concat(".", fractionPart)
        const cutLength = targetDigits + (value.includes(".") ? 1 : 0);
        value = value.slice(0,cutLength)

        //let lastDiscarded = value[cutLength + 1] //gets last discarded bit

        if (sign == "-"){
            let pntIndex = value.indexOf(".");
            let intPart = value.slice(0,pntIndex)
            let fracPart = value.slice(pntIndex+1)

            let fracPartUp = Number(fracPart)
            fracPartUp += 1
            value = intPart.concat(".", fracPartUp)
        }else{
            value = value.slice(0,cutLength)
            
            
        }

        return sign + value
    }

    static rndToNearest(integerPart, fractionPart, targetDigits, sign){
        //value = integerPart.concat(".", fractionPart)
        //const cutLength = targetDigits + (value.includes(".") ? 1 : 0);
        //let lastDiscarded = value[cutLength + 1] //gets last discarded bit

    }

}

/*
Sample Output:

Number  |   Truncate    |   RndUp   |   RndDown |
 1.55         1.5            1.6         1.5
-1.55        -1.5           -1.5        -1.6

*/ 
console.log(
    RoundingMethod.truncate("1", "55", 2, "")
);

console.log(
    RoundingMethod.rndUp("1", "55", 2, "")
);

console.log(
    RoundingMethod.rndDown("1", "55", 2, "")
);