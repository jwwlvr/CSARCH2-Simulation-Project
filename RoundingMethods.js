/**
 * IEEE 754 Double Precision (64-bit) Rounding Module
 */
class RoundingMethod {

/*
    Input 1: dec/bin number
    Input 2: target # of digits
    Output: round using all methods
*/
    static roundAll(input, targetDigits) {

        //check if dec or bin
        //extract sign, main digit, and remainder

        let sign = ""
        if (input[0] == "-"){
            sign = "-"
            input = input.slice(1) //remove negative sign for now
        }

        const pointIndex = input.indexOf(".");

        if (pointIndex === -1){
            //If user inputs a number without a fractional part
            return "Invalid Input"
        }

        const integerPart = input.slice(0,pointIndex)
        const fractionPart = input.slice(pointIndex+1)

        let binaryInput  = isBinary(integerPart) && isBinary(fractionPart)

        return {
            chopping: RoundingMethod.truncate(integerPart, fractionPart, targetDigits, sign),
            roundUp: RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign, binaryInput),
            roundDown: RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign, binaryInput),
            tiesToEven: RoundingMethod.rndToNearestTTE(integerPart, fractionPart, targetDigits, sign, binaryInput)
        };
    }

    static truncate(integerPart, fractionPart, targetDigits, sign) {
        // just chop values to target 
        let value = integerPart.concat(".", fractionPart)
        const cutLength = targetDigits + (value.includes(".") ? 1 : 0);
        value = value.slice(0,cutLength)
        return sign + value;
    }

    static rndUp(integerPart, fractionPart, targetDigits, sign, binaryInput) {
        // towards +positive infinity
        
        let value = integerPart.concat(".", fractionPart)
        const cutLength = targetDigits + (value.includes(".") ? 1 : 0);
        value = value.slice(0,cutLength)

        let pntIndex = value.indexOf(".");
        let intPart = value.slice(0,pntIndex)
        let fracPart = value.slice(pntIndex+1)

        if (sign == "-"){
            value = value.slice(0,cutLength)
        }else{
            if(binaryInput){
                let fracPartUp = (parseInt(fracPart, 2) + 1).toString(2);
                fracPartUp = fracPartUp.padStart(fracPart.length, "0");
                value = intPart.concat(".", fracPartUp)
            }else{

                let fracPartUp = Number(fracPart)
                fracPartUp += 1
                value = intPart.concat(".", fracPartUp)
            }
            
            
        }

        return sign + value

    }

    static rndDown(integerPart, fractionPart, targetDigits, sign, binaryInput){
        // towards -negative infinity

        let value = integerPart.concat(".", fractionPart)
        const cutLength = targetDigits + (value.includes(".") ? 1 : 0);
        value = value.slice(0,cutLength)

        let pntIndex = value.indexOf(".");
        let intPart = value.slice(0,pntIndex)
        let fracPart = value.slice(pntIndex+1)

        if (sign == "-"){
            if(binaryInput){
                let fracPartUp = (parseInt(fracPart, 2) + 1).toString(2);
                fracPartUp = fracPartUp.padStart(fracPart.length, "0");
                value = intPart.concat(".", fracPartUp)
            }else{

                let fracPartUp = Number(fracPart)
                fracPartUp += 1
                value = intPart.concat(".", fracPartUp)
            }
        }else{
            value = value.slice(0,cutLength)
            
            
        }

        return sign + value
    }

    static rndToNearestTTE(integerPart, fractionPart, targetDigits, sign, binaryInput){
        let value = integerPart.concat(".", fractionPart)
        const cutLength = targetDigits + (value.includes(".") ? 1 : 0);
        let lastDiscarded = value[cutLength] //gets last discarded bit for Decimal
        let binaryDiscarded = value.slice(cutLength)
        value = value.slice(0,cutLength)
        
        if (binaryInput){
            if (binaryDiscarded[0] === "0") {
            // less than half
                if (sign === "-") {
                    return RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign, binaryInput);
                } else {
                    return RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign, binaryInput);
                }
            }

            const remainingBits = binaryDiscarded.slice(1);

            if (remainingBits.includes("1")) {
            //greater than half
                if (sign === "-") {
                    return RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign, binaryInput);
                } else {
                    return RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign, binaryInput);
                }
            }

            const lastKeptBit = value[value.length - 1];
            
            if (lastKeptBit === "0") {
                // Even
                return sign + value;
            } else {
                // Odd 
                if (sign === "-") {
                    return RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign, binaryInput);
                } else {
                    return RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign, binaryInput);
                }
            }



        }else{
            if(lastDiscarded == "5"){
                //ties to even logic

                let pntIndex = value.indexOf(".");
                let intPart = value.slice(0,pntIndex)
                let fracPart = value.slice(pntIndex+1)
                let fracPartNum = Number(fracPart)

                if(fracPartNum % 2 === 0){
                    value = value.slice(0,cutLength)
                }else{
                    fracPartNum += 1
                    value = intPart.concat(".", fracPartNum)
                }

                return sign + value

            }else if(lastDiscarded < "5"){
                if(sign == "-"){
                    return RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign)
                }
                else{
                    return RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign)
                }
                
            }else{

                if(sign == "-"){
                    return RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign)
                }
                return RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign)
            }
        }

    }

}

function isBinary(str) {
    const num = parseInt(str, 2);
    return num.toString(2) === str;
}


/*
Sample Output:
Target: 2 digits
Number      |   Truncate    |   RndUp   |   RndDown |   RndToNearest,TiesToEven
 1.55            1.5            1.6         1.5                1.6
-1.55           -1.5           -1.5        -1.6               -1.6   

Target: 7 digits
Number          |   Truncate        |   RndUp       |   RndDown     |   RndToNearest,TiesToEven
-0.100101100        -0.100101         -0.100101        -0.100110            -0.100110
 0.100101110         0.100101          0.100110         0.100101             0.100110
*/

console.log("Number: 1.55   |   Target: 2 digits")
console.log(
    RoundingMethod.roundAll("1.55", 2)
);

console.log("\nNumber: -1.55   |   Target: 2 digits")
console.log(
    RoundingMethod.roundAll("-1.55", 2)
);

console.log("\nNumber: -0.100101100   |   Target: 7 digits")
console.log(
    RoundingMethod.roundAll("-0.100101100", 7)
);

console.log("\nNumber: 0.100101110   |   Target: 7 digits")
console.log(
    RoundingMethod.roundAll("0.100101110", 7)
);






