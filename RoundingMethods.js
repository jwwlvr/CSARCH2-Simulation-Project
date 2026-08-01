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

    static rndUp(value, targetNum, type) {
        // towards +positive infinity




    }

    static rndDown(value, targetNum, type){
        // towards -negative infinity
    }

    static rndToNearest(value, targetNum, type){

    }

}

console.log(
    RoundingMethod.truncate("10", "121212", 4, "")
);