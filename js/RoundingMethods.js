/**
 * IEEE 754 Double Precision (64-bit) Rounding Module
 */
class RoundingMethod {

/*
    Input 1: dec/bin number
    Input 2: target # of digits
    Output: round using all methods
*/
    static roundAll(input, targetDigits, format) {

        //check if dec or bin
        //extract sign, main digit, and remainder

        let sign = ""
        if (input[0] == "-"){
            sign = "-"
            input = input.slice(1) //remove negative sign for now
        }

        const pointIndex = input.indexOf(".");
        const hasPoint = pointIndex !== -1;

        // A decimal point is optional — a plain integer like "2323224" is
        // valid input, it just has no fraction part.
        const integerPart = hasPoint ? input.slice(0, pointIndex) : input;
        const fractionPart = hasPoint ? input.slice(pointIndex + 1) : "";

        const binaryInput = format === "binary";

        // The format is explicit (set via the dropdown) rather than guessed —
        // a decimal like "10.1" is no longer misread as binary just because it
        // happens to be made up of 0s and 1s. Still validate it matches the
        // chosen format so obviously wrong input (e.g. "12" as Binary) is caught.
        const digitsOk = binaryInput
            ? /^[01]*$/.test(integerPart) && /^[01]*$/.test(fractionPart)
            : /^[0-9]*$/.test(integerPart) && /^[0-9]*$/.test(fractionPart);
        if (!digitsOk || integerPart.length === 0) {
            return "Invalid Input";
        }

        return {
            chopping: RoundingMethod.truncate(integerPart, fractionPart, targetDigits, sign),
            roundUp: RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign, binaryInput),
            roundDown: RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign, binaryInput),
            tiesToEven: RoundingMethod.rndToNearestTTE(integerPart, fractionPart, targetDigits, sign, binaryInput)
        };
    }

    // Builds "intPart.fracPart", only inserting the "." when there is
    // actually a fraction part left after cutting. This is what lets a
    // cut that lands entirely inside the integer part (e.g. 1023.3 -> 102)
    // come out as a plain integer with no trailing dot.
    static buildValue(intPart, fracPart) {
        return fracPart.length > 0 ? intPart.concat(".", fracPart) : intPart;
    }

    // The core of every method below: targetDigits counts PURE digits —
    // the decimal point itself is never one of them. We flatten
    // "intPart"+"fracPart" into one digit string, take the first
    // targetDigits of it, and only re-insert a "." if the cut point falls
    // past the end of the integer part. Also returns whatever digits were
    // discarded, needed for the rounding decision.
    //
    // Examples (targetDigits=3): "1023.3" -> kept "102", frac "" (cut lands
    // inside the integer, so no dot at all). "1.55" (targetDigits=2) ->
    // kept int "1", frac "5" (cut spills one digit into the fraction).
    static splitAtTarget(integerPart, fractionPart, targetDigits) {
        const digits = integerPart + fractionPart;
        const intLen = integerPart.length;
        const kept = digits.slice(0, targetDigits);
        const discarded = digits.slice(targetDigits);

        let intPart, fracPart;
        if (targetDigits <= intLen) {
            intPart = kept;
            fracPart = "";
        } else {
            intPart = kept.slice(0, intLen);
            fracPart = kept.slice(intLen);
        }
        return { intPart, fracPart, discarded };
    }

    static truncate(integerPart, fractionPart, targetDigits, sign) {
        const { intPart, fracPart } = RoundingMethod.splitAtTarget(integerPart, fractionPart, targetDigits);
        return sign + RoundingMethod.buildValue(intPart, fracPart);
    }

    // Increments a truncated "intPart.fracPart" value by one unit in the last
    // kept place, propagating carry through the fraction into the integer
    // part (e.g. "1.99" -> "2.00", "0.9" -> "1.0", "999" -> "1000"). Works
    // for decimal or binary strings depending on `base`.
    static incrementAtLastPlace(intPart, fracPart, base = 10) {
        const digits = (intPart + fracPart).split("").map(Number);
        let carry = 1;
        for (let i = digits.length - 1; i >= 0 && carry; i--) {
            digits[i] += carry;
            if (digits[i] >= base) {
                digits[i] -= base;
                carry = 1;
            } else {
                carry = 0;
            }
        }
        if (carry) digits.unshift(carry);

        const newFracLen = fracPart.length;
        const combined = digits.join("");
        const newFrac = newFracLen > 0 ? combined.slice(combined.length - newFracLen) : "";
        const newInt = newFracLen > 0 ? (combined.slice(0, combined.length - newFracLen) || "0") : combined;
        return { intPart: newInt, fracPart: newFrac };
    }

    static rndUp(integerPart, fractionPart, targetDigits, sign, binaryInput) {
        // towards +positive infinity
        const { intPart, fracPart } = RoundingMethod.splitAtTarget(integerPart, fractionPart, targetDigits);

        let value;
        if (sign == "-"){
            // Magnitude is truncated; "up" toward +infinity means toward 0.
            value = RoundingMethod.buildValue(intPart, fracPart)
        }else{
            const base = binaryInput ? 2 : 10;
            const bumped = RoundingMethod.incrementAtLastPlace(intPart, fracPart, base);
            value = RoundingMethod.buildValue(bumped.intPart, bumped.fracPart)
        }

        return sign + value
    }

    static rndDown(integerPart, fractionPart, targetDigits, sign, binaryInput){
        // towards -negative infinity
        const { intPart, fracPart } = RoundingMethod.splitAtTarget(integerPart, fractionPart, targetDigits);

        let value;
        if (sign == "-"){
            // Magnitude grows; "down" toward -infinity means away from 0.
            const base = binaryInput ? 2 : 10;
            const bumped = RoundingMethod.incrementAtLastPlace(intPart, fracPart, base);
            value = RoundingMethod.buildValue(bumped.intPart, bumped.fracPart)
        }else{
            value = RoundingMethod.buildValue(intPart, fracPart)
        }

        return sign + value
    }

    static rndToNearestTTE(integerPart, fractionPart, targetDigits, sign, binaryInput){
        const { intPart, fracPart, discarded } = RoundingMethod.splitAtTarget(integerPart, fractionPart, targetDigits);
        const value = RoundingMethod.buildValue(intPart, fracPart);

        if (binaryInput){
            if (discarded.length === 0) {
                // Nothing discarded — value already fits, it's exact.
                return sign + value;
            }

            if (discarded[0] === "0") {
            // less than half
                if (sign === "-") {
                    return RoundingMethod.rndUp(integerPart, fractionPart, targetDigits, sign, binaryInput);
                } else {
                    return RoundingMethod.rndDown(integerPart, fractionPart, targetDigits, sign, binaryInput);
                }
            }

            const remainingBits = discarded.slice(1);

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
            const lastDiscarded = discarded[0]; // first discarded digit, or undefined if nothing was discarded

            if (lastDiscarded === undefined) {
                // Nothing discarded — value already fits, it's exact.
                return sign + value;
            }

            if(lastDiscarded == "5"){
                //ties to even logic
                const lastKeptDigit = Number((fracPart || intPart).slice(-1));

                let newIntPart = intPart;
                let newFracPart = fracPart;
                if (lastKeptDigit % 2 !== 0) {
                    const bumped = RoundingMethod.incrementAtLastPlace(intPart, fracPart, 10);
                    newIntPart = bumped.intPart;
                    newFracPart = bumped.fracPart;
                }

                return sign + RoundingMethod.buildValue(newIntPart, newFracPart)

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

Target: 3 digits, cut lands before the decimal point
Number      |   Truncate
1023.3           102

Target: 4 digits, no decimal point at all
Number      |   Truncate
2323224          2323
*/

console.log("Number: 1.55   |   Target: 2 digits")
console.log(
    RoundingMethod.roundAll("1.55", 2, "decimal")
);

console.log("\nNumber: -1.55   |   Target: 2 digits")
console.log(
    RoundingMethod.roundAll("-1.55", 2, "decimal")
);

console.log("\nNumber: -0.100101100   |   Target: 7 digits")
console.log(
    RoundingMethod.roundAll("-0.100101100", 7, "binary")
);

console.log("\nNumber: 0.100101110   |   Target: 7 digits")
console.log(
    RoundingMethod.roundAll("0.100101110", 7, "binary")
);

console.log("\nNumber: 1023.3   |   Target: 3 digits")
console.log(
    RoundingMethod.roundAll("1023.3", 3, "decimal")
);

console.log("\nNumber: 2323224   |   Target: 4 digits (no decimal point)")
console.log(
    RoundingMethod.roundAll("2323224", 4, "decimal")
);


//action listener for rounding.html
document.addEventListener("DOMContentLoaded", () => {
    const numberInput = document.getElementById('numberInput');
    const numberFormat = document.getElementById('numberFormat');
    const precisionInput = document.getElementById('precisionInput');

    const choppingOutput = document.getElementById('choppingOutput');
    const roundUpOutput = document.getElementById('roundUpOutput');
    const roundDownOutput = document.getElementById('roundDownOutput');
    const roundNearestOutput = document.getElementById('roundNearestOutput');
    const hint = document.getElementById('roundingHint');

    if (!numberInput) return; // not on this page

    function clearOutputs() {
        choppingOutput.textContent = "";
        roundUpOutput.textContent = "";
        roundDownOutput.textContent = "";
        roundNearestOutput.textContent = "";
    }

    function setHint(message) {
        if (hint) hint.textContent = message || "";
    }

    function handleRoundingConversion() {
        const numValue = numberInput.value.trim();
        const precValue = precisionInput.value.trim();
        const format = numberFormat ? numberFormat.value : "decimal";

        setHint("");

        if (!numValue || !precValue) {
            clearOutputs();
            return;
        }

        try {
            const targetDigits = parseInt(precValue, 10);

            if (isNaN(targetDigits) || targetDigits < 0) {
                clearOutputs();
                setHint("Target precision must be a whole number of 0 or more.");
                return;
            }

            //Calling the rounding methods and updating the output fields base on the result
            const result = RoundingMethod.roundAll(numValue, targetDigits, format);

            if (!result || result === "Invalid Input") {
                clearOutputs();
                setHint(format === "binary"
                    ? "Binary numbers can only use 0 and 1 digits — switch the format to Decimal if that's what you meant."
                    : "Decimal numbers can only use digits 0–9 — switch the format to Binary if that's what you meant.");
                return;
            }

            choppingOutput.textContent = result.chopping || result.chop || "";
            roundUpOutput.textContent = result.roundUp || "";
            roundDownOutput.textContent = result.roundDown || "";
            roundNearestOutput.textContent = result.tiesToEven || result.roundNearest || "";
        } catch (e) {
            clearOutputs();
            setHint("Couldn't round that input — double check the format.");
        }
    }

    // It creates a listener on both input fields and deploys the function whenever a change occurs in either of them.
    ['input', 'change', 'keyup'].forEach(eventType => {
        numberInput.addEventListener(eventType, handleRoundingConversion);
        precisionInput.addEventListener(eventType, handleRoundingConversion);
    });
    numberFormat?.addEventListener('change', handleRoundingConversion);
});