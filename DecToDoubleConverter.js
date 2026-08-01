/**
 * Decimal to Binary (Double-Precision) Converter
 */

class DecToDoubleConverter {
    // convert
    static convert(input) {
        let string = String(input).trim();
        let text = [];

        // check sign
        let sign = "0";
        if (string.startsWith("-")) {
            sign = "1";
            string = string.slice(1);
        } else if (string.startsWith("+")) {
            string = string.slice(1);
        }

        // check for special cases
        let lowerString = string.toLowerCase();
        // +0
        if (lowerString === "0" || lowerString === "+0") {
            return this.pack("0", "00000000000", "0".repeat(52), ["Special case: +0"]);
        }
        // -0
        if (lowerString === "-0") {
            return this.pack("1", "00000000000", "0".repeat(52), ["Special case: -0"]);
        }
        // + infinity
        if (lowerString === "infinity" || lowerString === "inf" || lowerString === "+infinity" || lowerString === "+inf") {
            return this.pack("0", "11111111111", "0".repeat(52), ["Special case: +Infinity"]);
        }
        // - infinity
        if (lowerString === "-infinity" || lowerString === "-inf") {
            return this.pack("1", "11111111111", "0".repeat(52), ["Special case: -Infinity"]);
        }
        // sNaN
        if (lowerString === "snan") {
            let mantissa = "01" + "0".repeat(50);
            return this.pack("0", "11111111111", mantissa, ["Special Case: Signaling NaN"]);
        }
        // qNaN
        if (lowerString === "nan" || lowerString === "qnan") {
            let mantissa = "1" + "0".repeat(51);
            return this.pack("0", "11111111111", mantissa, ["Special Case: Quiet NaN"]);
        }

        // check if valid dec number

        // separate int and fraction
        let parts = string.split(".");
        let intPart = parts[0] || "0"; // if starts w ., first part is automatically 0
        let fractionPart = parts[1] || ""; // skips fraction if none typed

        // use of BigInt for more precision
        if (BigInt(intPart) === BigInt(0) && (fractionPart === "" || /^[0]+$/.test(fractionPart))) {
            return this.pack(sign, "00000000000", "0".repeat(52), ["Value is 0"]);
        }

        // int part to binary
        let intValue = BigInt(intPart);
        let intBinary = intValue === BigInt(0) ? "0" : intValue.toString(2); // convert to binary if not zero

        // fraction part to binary
        let fractionBinary = "";
        let exactFraction = false;

        if (fractionPart !== "") {
            let number = BigInt(fractionPart); // use BigInt for precision
            let denominator = BigInt(10) ** BigInt(fractionPart.length); // denominator based on number of digits
            
            // 1100 since double precision
            for (let i = 0; i < 1100; i++) {
                number *= BigInt(2);
                let bit = number / denominator;
                fractionBinary += bit.toString();
                number = number % denominator;

                // exact fraction check
                if (number === BigInt(0)) {
                    exactFraction = true;
                    break;
                }
            }
        } else {
            exactFraction = true; // no fraction part means exact
        }

        text.push(`Integer Binary: ${intBinary}`);
        text.push(`Fraction Binary: ${fractionBinary.slice(0,32)}${fractionBinary.length > 30 ? "..." : ""}`);

        // combine and normalize
        let wholeBits = "";
        let exponent = 0;

        // if int part is not zero, use it to determine exponent
        if (intValue !== BigInt(0)) {
            wholeBits = intBinary + fractionBinary;
            // have to move dec point after first 1 in int part
            exponent = intBinary.length - 1;
        } else {
            // searches for first 1 in frac part
            let firstIndx = fractionBinary.indexOf("1");
            if (firstIndx === -1) {
                text.push("No 1 found in fraction part, value is 0");
                return this.pack(sign, "00000000000", "0".repeat(52), text);
            }
            // trim leading zeros and set exponent
            wholeBits = fractionBinary.slice(firstIndx);
            exponent = -(firstIndx + 1);
        }

        text.push(`Normalized Binary: ${exponent}`);

        // handle exponent and mantissa
        // extract mantissa bits (52 bits)
        // extract GRS
        // biased exp
        // pack func
        // test cases
        

    }

}
