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

        // check for special cases (string)
        let lowerString = string.toLowerCase();
        // -0
        if (lowerString === "-0") {
            return this.pack("1", "00000000000", "0".repeat(52), ["Special case: -0"]);
        }
        // +0
        if (lowerString === "0" || lowerString === "+0") {
            return this.pack("0", "00000000000", "0".repeat(52), ["Special case: +0"]);
        }
        // - infinity
        if (lowerString === "-infinity" || lowerString === "-inf") {
            return this.pack("1", "11111111111", "0".repeat(52), ["Special case: -Infinity"]);
        }
        // + infinity
        if (lowerString === "infinity" || lowerString === "inf" || lowerString === "+infinity" || lowerString === "+inf") {
            return this.pack("0", "11111111111", "0".repeat(52), ["Special case: +Infinity"]);
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

        // if overflow
        if (exponent > 1023) {
            text.push("Exponent overflow")
            return this.pack(sign, "11111111111", "0".repeat(52), text);
        }

        // denormalized
        let isDenormalized = false;
        if (exponent < -1022) {
            isDenormalized = true;
        }
        let bitOffset = isDenormalized ? (exponent + 1022) : 0; // if denormalized, shift bits to right
        
        // helper to get bits
        let getBits = (index) => {
            let position = bitOffset + index;
            // if out of bounds, return 0
            if (position < 0 || position >= wholeBits.length) {
                return "0";
            }
            return wholeBits[position]; 
        };

        // get mantissa bits (52 bits)
        let mantissa = "";
        for (let i = 1; i <= 52; i++) {
            mantissa += getBits(i);
        }

        // get GRS
        let guardBit = getBits(53);
        let roundBit = getBits(54);
        let stickyBit = "0";

        for (let i = bitOffset + 55; i < wholeBits.length; i++) {
            // if ANY bit after round bit is 1, S is 1
            if (wholeBits[i] === "1") {
                stickyBit = "1";
                break;
            }
        }
        // if not exact frac, S is automatically 1
        if (!exactFraction) {
            stickyBit = "1";
        }

        text.push(`Mantissa: ${mantissa}`);
        text.push(`Guard Bit: ${guardBit}`);
        text.push(`Round Bit: ${roundBit}`);
        text.push(`Sticky Bit: ${stickyBit}`);

        let mantissaInt = BigInt("0b" + mantissa);
        let rndUp = false;
        if ((guardBit === "1") && (roundBit === "1" || stickyBit === "1" || (mantissaInt & 1n) === 1n)) {
            rndUp = true;
        }
        let carry = 0n;

        if (rndUp) {
            text.push("Rounding up");
            mantissaInt += 1n;

            // overflow check
            if (mantissaInt >= (1n << 52n)) {
                carry = 1n;
                mantissaInt = 0n; // reset mantissa to 0
            }
        } else {
            text.push("No rounding needed");
        }

        // biased exp
        let biasedExp = 0n;
        if (isDenormalized) {
            biasedExp = carry; // exp is 0 for denormalized, but if w carry, 1
        } else {
            biasedExp = BigInt(exponent + 1023) + carry;
        }

        // check for overflow after rounding
        if (biasedExp >= 2047n) {
            text.push("Exponent overflow");
            return this.pack(sign, "11111111111", "0".repeat(52), text);
        }

        let expBits = biasedExp.toString(2).padStart(11, "0");// ensure 11 bits
        let finalMantissa = mantissaInt.toString(2).padStart(52, "0"); // ensure 52 bits

        return this.pack(sign, expBits, finalMantissa, text);

    }

    // helper to pack ino obj
    static pack(sign, expBits, mantissaBits, text = []) {
            let bits64 = sign + expBits + mantissaBits;
            let binaryString = `${sign} ${expBits} ${mantissaBits}`;

            let hexString = "";
            for (let i = 0; i < 64; i += 4) {
                // take 4 bits at a time
                let nibble = bits64.slice(i, i + 4);
                hexString += parseInt(nibble, 2).toString(16).toUpperCase();
            }

            return {
                sign: sign === "1" ? "-" : "+",
                text: text,
                binary: binaryString,
                hex: hexString
            }
        }
}

// Test Cases
console.log("3.25");
console.log(DecToDoubleConverter.convert("3.25"));

console.log("-0.1");
console.log(DecToDoubleConverter.convert("-0.1"));

console.log("snan");
console.log(DecToDoubleConverter.convert("snan"));


//Event listener for dectodouble.html
document.addEventListener("DOMContentLoaded", () => {
    const decimalInput = document.getElementById('decimalInput');
    const floatOutput = document.getElementById('floatOutput');
    const fullBinaryOutput = document.getElementById('fullBinaryOutput');
    
    // 64-Bit Layout outputs
    const signBitOutput = document.getElementById('signBitOutput');
    const exponentBitsOutput = document.getElementById('exponentBitsOutput');
    const mantissaBitsOutput = document.getElementById('mantissaBitsOutput');

    // Representation Analysis outputs
    const signAnalysisOutput = document.getElementById('signAnalysisOutput');
    const exponentAnalysisOutput = document.getElementById('exponentAnalysisOutput');
    const mantissaAnalysisOutput = document.getElementById('mantissaAnalysisOutput');

    function handleConversion() {
        const value = decimalInput.value;

        // Clear output fields if input is empty
        if (!value.trim()) {
            floatOutput.textContent = "";
            fullBinaryOutput.textContent = "";
            signBitOutput.textContent = "";
            exponentBitsOutput.textContent = "";
            mantissaBitsOutput.textContent = "";
            signAnalysisOutput.textContent = "";
            exponentAnalysisOutput.textContent = "";
            mantissaAnalysisOutput.textContent = "";
            return;
        }

        try {
            const result = DecToDoubleConverter.convert(value);

            if (result && result.binary) {
                floatOutput.textContent = result.hex || "";
                fullBinaryOutput.textContent = result.binary || "";

                const parts = result.binary.split(" ");
                
                // Bit layout outputs
                signBitOutput.textContent = parts[0] || "";
                exponentBitsOutput.textContent = parts[1] || "";
                mantissaBitsOutput.textContent = parts[2] || "";

                // Sign analysis
                signAnalysisOutput.textContent = `${result.sign === "+" ? "Positive (+)" : "Negative (-)"} -> Bit: ${parts[0]}`;

                // Exponent analysis with error handling
                let normText = result.text ? result.text.find(t => t.startsWith("Normalized Binary:")) : null;
                if (normText) {
                    let rawExponent = BigInt(normText.split(": ")[1] || "0");
                    let biasedValue = rawExponent + 1023n;
                    exponentAnalysisOutput.textContent = `${rawExponent} + 1023 = ${biasedValue} (${parts[1] || ""})`;
                } else {
                    exponentAnalysisOutput.textContent = parts[1] || "N/A";
                }

                // Mantissa analysis
                let mantText = result.text ? result.text.find(t => t.startsWith("Mantissa:")) : null;
                let mantissaBits = mantText ? mantText.replace("Mantissa: ", "") : (parts[2] || "");

                //turn the matissa bits into its decimal equivalent
                let decimalValue = 0;
                for(let i = 0; i < mantissaBits.length; i++) {
                    if(mantissaBits[i] === "1"){
                        decimalValue += Math.pow(2, -(i + 1));
                    }
                }


                mantissaAnalysisOutput.textContent = decimalValue.toFixed(10);
            }
        } catch (error) {
            // Input isn't a complete/valid number yet (e.g. mid-typing) — clear outputs quietly
            floatOutput.textContent = "";
            fullBinaryOutput.textContent = "";
            signBitOutput.textContent = "";
            exponentBitsOutput.textContent = "";
            mantissaBitsOutput.textContent = "";
            signAnalysisOutput.textContent = "";
            exponentAnalysisOutput.textContent = "";
            mantissaAnalysisOutput.textContent = "";
        }
    }

    decimalInput.addEventListener('input', handleConversion);
});