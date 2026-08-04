/**
 * IEEE 754 Double Precision (64-bit) Arithmetic Module
 * Uses BigInt for precise bitwise manipulation to simulate hardware-level GRS logic.
 * Updated to support mixed-sign addition, NaN/Infinity early exits, and subnormals.
 */
class IEEE754Arithmetic {
    
    // Constants for 64-bit Double Precision
    static BIAS = 1023n;
    static FRACTION_BITS = 52n;
    static HIDDEN_BIT = 1n << 52n; 

    /**
     * Unpacks a 64-bit hex string into Sign, Exponent, and Mantissa (with hidden bit).
     */
    static unpackHex(hexStr) {
        const num = BigInt("0x" + hexStr);
        const sign = num >> 63n;
        let exp = (num >> this.FRACTION_BITS) & 0x7FFn;
        let mantissa = num & ((1n << this.FRACTION_BITS) - 1n);

        // Identify Special Cases
        const isZero = (exp === 0n && mantissa === 0n);
        const isNaN = (exp === 2047n && mantissa !== 0n);
        const isInfinity = (exp === 2047n && mantissa === 0n);

        // FIX 4: Subnormal Exponent Alignment[cite: 2]
        // Subnormals have a biased exp of 0, but mathematically behave as exp 1.
        if (exp === 0n && !isZero) {
            exp = 1n; 
        } else if (exp > 0n && exp < 2047n) {
            mantissa = mantissa | this.HIDDEN_BIT; // Add hidden bit for normalized numbers
        }

        return { sign, exp, mantissa, isZero, isNaN, isInfinity };
    }

    /**
     * Packs Sign, Exponent, and Mantissa back into a 64-bit Hex and Binary string.
     */
    static pack(sign, exp, mantissa) {
        // Remove hidden bit safely 
        const fraction = mantissa & ((1n << this.FRACTION_BITS) - 1n);
        const result = (sign << 63n) | (exp << this.FRACTION_BITS) | fraction;
        
        let binaryStr = result.toString(2).padStart(64, '0');
        const spacedBinary = `${binaryStr.slice(0, 1)} ${binaryStr.slice(1, 12)} ${binaryStr.slice(12)}`;
        const hexStr = result.toString(16).toUpperCase().padStart(16, '0');

        return {
            binary: spacedBinary,
            hex: hexStr,
            decimal: this.hexToFloat64(hexStr) 
        };
    }

    static hexToFloat64(hex) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        // Split 64-bit hex into two 32-bit halves for DataView compatibility[cite: 2]
        view.setUint32(0, parseInt(hex.substring(0, 8), 16));
        view.setUint32(4, parseInt(hex.substring(8, 16), 16));
        return view.getFloat64(0);
    }

    /**
     * Helper to return standard formats for Special Cases
     */
    static getSpecialCasePack(type, sign = 0n) {
        if (type === "NaN") return this.pack(0n, 2047n, 1n << 51n); // qNaN
        if (type === "Infinity") return this.pack(sign, 2047n, 0n);
        if (type === "Zero") return this.pack(sign, 0n, 0n);
    }

    /**
     * Performs Multiplication using GRS.
     */
    static multiply(hexA, hexB) {
        const steps = [];
        let n = 1; // running step counter, so numbering always stays contiguous
        const opA = this.unpackHex(hexA);
        const opB = this.unpackHex(hexB);

        steps.push(`Step ${n++}: Unpack Operands -> A: sign=${opA.sign}, biased exp=${opA.exp} (unbiased ${opA.exp - this.BIAS}), mantissa=0x${opA.mantissa.toString(16).toUpperCase().padStart(14, "0")} | B: sign=${opB.sign}, biased exp=${opB.exp} (unbiased ${opB.exp - this.BIAS}), mantissa=0x${opB.mantissa.toString(16).toUpperCase().padStart(14, "0")}`);

        // 1. Determine Sign
        const resultSign = opA.sign ^ opB.sign;
        steps.push(`Step ${n++}: Calculate Sign -> ${opA.sign} XOR ${opB.sign} = ${resultSign}`);

        // FIX 2: Early Exits for Special Cases (Multiply)[cite: 2]
        if (opA.isNaN || opB.isNaN) return { operation: "Multiplication", steps: ["NaN operand encountered."], final: this.getSpecialCasePack("NaN") };
        if (opA.isInfinity) {
            if (opB.isZero) return { operation: "Multiplication", steps: ["Inf * 0 = NaN"], final: this.getSpecialCasePack("NaN") };
            return { operation: "Multiplication", steps: ["Infinity operand encountered."], final: this.getSpecialCasePack("Infinity", resultSign) };
        }
        if (opB.isInfinity) {
            if (opA.isZero) return { operation: "Multiplication", steps: ["0 * Inf = NaN"], final: this.getSpecialCasePack("NaN") };
            return { operation: "Multiplication", steps: ["Infinity operand encountered."], final: this.getSpecialCasePack("Infinity", resultSign) };
        }
        if (opA.isZero || opB.isZero) return { operation: "Multiplication", steps: ["Multiply by Zero."], final: this.getSpecialCasePack("Zero", resultSign) };

        // 2. Add Exponents
        let resultExp = opA.exp + opB.exp - this.BIAS;
        steps.push(`Step ${n++}: Add Exponents -> ${opA.exp} + ${opB.exp} - ${this.BIAS} (bias) = ${resultExp}`);

        // 3. Multiply Mantissas
        let product = opA.mantissa * opB.mantissa;
        let isNormalized = (product & (1n << 105n)) !== 0n;

        steps.push(`Step ${n++}: Multiply Mantissas -> raw ${product.toString(2).length}-bit product; leading bit is ${isNormalized ? "at position 105 (already normalized)" : "at position 104 (needs a 1-bit left shift to normalize)"}`);

        if (isNormalized) {
            resultExp += 1n;
        } else {
            product = product << 1n;
        }
        steps.push(`Step ${n++}: Normalize Product -> ${isNormalized ? `bit already in place, exponent bumped to ${resultExp}` : `shifted product left 1 bit, exponent stays ${resultExp}`}`);

        // 4. Calculate GRS Bits
        let newMantissa = product >> 53n;
        const G = (product >> 52n) & 1n;
        const R = (product >> 51n) & 1n;
        const stickyMask = (1n << 51n) - 1n;
        const S = (product & stickyMask) > 0n ? 1n : 0n;
        steps.push(`Step ${n++}: Guard/Round/Sticky Bits -> G=${G}, R=${R}, S=${S}`);

        // 5. Rounding
        const willRoundUp = G === 1n && (R === 1n || S === 1n || (newMantissa & 1n) === 1n);
        steps.push(`Step ${n++}: Rounding Decision (round-to-nearest, ties-to-even) -> ${willRoundUp ? `G=1 and (R=1 or S=1 or LSB=1) → round up` : `condition not met → no rounding`}`);
        if (willRoundUp) {
            newMantissa += 1n;
            if ((newMantissa & (1n << 53n)) !== 0n) {
                newMantissa = newMantissa >> 1n;
                resultExp += 1n;
                steps.push(`Step ${n++}: Rounding Carried Out of Mantissa -> shifted right 1 bit, exponent bumped to ${resultExp}`);
            }
        }

        if (resultExp >= 2047n) {
            steps.push(`Step ${n++}: Exponent Overflow -> Returning Infinity`);
            return { operation: "Multiplication", steps, final: this.getSpecialCasePack("Infinity", resultSign) };
        }
        if (resultExp <= 0n) {
            steps.push(`Step ${n++}: Exponent Underflow (${resultExp}) -> Normalizing to Subnormal`);
            const shiftAmt = 1n - resultExp;
            // Shift mantissa down to adjust for subnormal range
            newMantissa = newMantissa >> (shiftAmt > 54n ? 54n : shiftAmt); 
            resultExp = 0n;
        }

        steps.push(`Step ${n++}: Final Exponent -> unbiased=${resultExp === 0n ? "subnormal" : resultExp - this.BIAS}, biased=${resultExp}`);
        steps.push(`Step ${n++}: Final Mantissa (fraction bits) -> 0b${(newMantissa & ((1n << this.FRACTION_BITS) - 1n)).toString(2).padStart(52, "0")}`);

        const finalFormat = this.pack(resultSign, resultExp, newMantissa);
        return { operation: "Multiplication", steps, final: finalFormat };
    }

    /**
     * Performs Addition (and Subtraction) using GRS alignment.
     */
    static add(hexA, hexB) {
        const steps = [];
        let n = 1; // running step counter, so numbering always stays contiguous
        const opA = this.unpackHex(hexA);
        const opB = this.unpackHex(hexB);

        steps.push(`Step ${n++}: Unpack Operands -> A: sign=${opA.sign}, biased exp=${opA.exp} (unbiased ${opA.exp - this.BIAS}), mantissa=0x${opA.mantissa.toString(16).toUpperCase().padStart(14, "0")} | B: sign=${opB.sign}, biased exp=${opB.exp} (unbiased ${opB.exp - this.BIAS}), mantissa=0x${opB.mantissa.toString(16).toUpperCase().padStart(14, "0")}`);

        // FIX 2: Early Exits for Special Cases (Addition)[cite: 2]
        if (opA.isNaN || opB.isNaN) return { operation: "Addition", steps: ["NaN operand encountered."], final: this.getSpecialCasePack("NaN") };
        if (opA.isInfinity && opB.isInfinity) {
            if (opA.sign !== opB.sign) return { operation: "Addition", steps: ["+Inf + -Inf = NaN"], final: this.getSpecialCasePack("NaN") };
            return { operation: "Addition", steps: ["Inf + Inf = Inf"], final: this.getSpecialCasePack("Infinity", opA.sign) };
        }
        if (opA.isInfinity) return { operation: "Addition", steps: ["Infinity operand encountered."], final: this.getSpecialCasePack("Infinity", opA.sign) };
        if (opB.isInfinity) return { operation: "Addition", steps: ["Infinity operand encountered."], final: this.getSpecialCasePack("Infinity", opB.sign) };

        // Determine Larger vs Smaller
        let larger, smaller;
        if (opA.exp > opB.exp || (opA.exp === opB.exp && opA.mantissa >= opB.mantissa)) {
            larger = opA; smaller = opB;
        } else {
            larger = opB; smaller = opA;
        }

        let resultSign = larger.sign; 
        steps.push(`Step ${n++}: Determine Sign -> sign of larger-magnitude operand = ${resultSign}`);
        const expDiff = larger.exp - smaller.exp;
        let G = 0n, R = 0n, S = 0n;
        let alignedMantissa = smaller.mantissa;

        // Shift smaller mantissa right and calculate GRS
        if (expDiff > 0n) {
            let shiftAmt = expDiff > 55n ? 55n : expDiff;
            const shiftedOut = alignedMantissa & ((1n << shiftAmt) - 1n);
            alignedMantissa = alignedMantissa >> shiftAmt;

            G = (shiftedOut >> (shiftAmt - 1n)) & 1n;
            R = shiftAmt > 1n ? (shiftedOut >> (shiftAmt - 2n)) & 1n : 0n;
            const stickyMask = (1n << (shiftAmt - 2n)) - 1n;
            S = (shiftedOut & stickyMask) > 0n ? 1n : 0n;
            steps.push(`Step ${n++}: Align Exponents -> exponent difference = ${expDiff}, shift smaller operand's mantissa right ${shiftAmt} bit(s)`);
        } else {
            steps.push(`Step ${n++}: Align Exponents -> exponents already equal, no shift needed`);
        }
        steps.push(`Step ${n++}: Guard/Round/Sticky Bits (from alignment) -> G=${G}, R=${R}, S=${S}`);

        let resultMantissa;
        let resultExp = larger.exp;

        if (opA.sign === opB.sign) {
            // Standard Addition
            steps.push(`Step ${n++}: Same Signs -> add the two mantissas`);
            resultMantissa = larger.mantissa + alignedMantissa;
            
            // Normalize overflow
            if ((resultMantissa & (1n << 53n)) !== 0n) {
                S = S | R; R = G; G = resultMantissa & 1n;
                resultMantissa = resultMantissa >> 1n;
                resultExp += 1n;
                steps.push(`Step ${n++}: Normalize -> sum overflowed 53 bits, shift right 1, exponent bumped to ${resultExp}, GRS bits cycled to G=${G}, R=${R}, S=${S}`);
            } else {
                steps.push(`Step ${n++}: Normalize -> sum fits in 53 bits, no shift needed`);
            }
        } else {
            // Mixed Sign Subtraction
            steps.push(`Step ${n++}: Differing Signs -> subtract smaller-magnitude mantissa from larger-magnitude mantissa`);
            let borrow = 0n, gSub = 0n, rSub = 0n, sSub = 0n;
            
            // Borrow logic through GRS bits
            if (S > 0n) { sSub = 1n; borrow = 1n; }
            if (R > 0n || borrow > 0n) { 
                rSub = (0n - R - borrow) & 1n; 
                borrow = (R > 0n || borrow > 0n) ? 1n : 0n; 
            }
            if (G > 0n || borrow > 0n) {
                 gSub = (0n - G - borrow) & 1n;
                 borrow = (G > 0n || borrow > 0n) ? 1n : 0n;
            }

            resultMantissa = larger.mantissa - alignedMantissa - borrow;
            G = gSub; R = rSub; S = sSub;
            steps.push(`Step ${n++}: Borrow Through GRS Bits -> post-borrow G=${G}, R=${R}, S=${S}`);

            // Total cancellation mapping to +0
            if (resultMantissa === 0n && G === 0n && R === 0n && S === 0n) {
                steps.push(`Step ${n++}: Exact Cancellation -> operands were equal magnitude, opposite sign, result is +0`);
                return { operation: "Addition (Subtraction)", steps, final: this.pack(0n, 0n, 0n) };
            }

            // Normalize Subtraction Result (Shift left to restore hidden bit)
            let shiftCount = 0n;
            while ((resultMantissa & this.HIDDEN_BIT) === 0n && resultExp > 0n) {
                resultMantissa = (resultMantissa << 1n) | G;
                G = R; R = S; S = 0n; // Cycle bits up
                resultExp -= 1n;
                shiftCount += 1n;
            }
            steps.push(shiftCount > 0n
                ? `Step ${n++}: Normalize -> leading zero(s) found, shifted left ${shiftCount} bit(s) to restore the hidden bit, exponent dropped to ${resultExp}`
                : `Step ${n++}: Normalize -> hidden bit already in place, no shift needed`);
        }

        // Round-to-nearest ties-to-even
        const willRoundUp = G === 1n && (R === 1n || S === 1n || (resultMantissa & 1n) === 1n);
        steps.push(`Step ${n++}: Rounding Decision (round-to-nearest, ties-to-even) -> ${willRoundUp ? `G=1 and (R=1 or S=1 or LSB=1) → round up` : `condition not met → no rounding`}`);
        if (willRoundUp) {
            resultMantissa += 1n;
             if ((resultMantissa & (1n << 53n)) !== 0n) {
                resultMantissa = resultMantissa >> 1n;
                resultExp += 1n;
                steps.push(`Step ${n++}: Rounding Carried Out of Mantissa -> shifted right 1 bit, exponent bumped to ${resultExp}`);
             }
        }

        if (resultExp >= 2047n) {
            steps.push(`Step ${n++}: Exponent Overflow -> Returning Infinity`);
            return { operation: "Addition", steps, final: this.getSpecialCasePack("Infinity", resultSign) };
        }
        if (resultExp <= 0n && resultMantissa !== 0n) {
            resultExp = 0n; // Set Biased Exponent for Subnormal
            steps.push(`Step ${n++}: Exponent Underflow -> normalized to subnormal, biased exponent set to 0`);
        }

        steps.push(`Step ${n++}: Final Exponent -> unbiased=${resultExp === 0n ? "subnormal" : resultExp - this.BIAS}, biased=${resultExp}`);
        steps.push(`Step ${n++}: Final Mantissa (fraction bits) -> 0b${(resultMantissa & ((1n << this.FRACTION_BITS) - 1n)).toString(2).padStart(52, "0")}`);

        const finalFormat = this.pack(resultSign, resultExp, resultMantissa);
        return { operation: "Addition", steps, final: finalFormat };
    }
}

/**
 * Converts a user-typed operand into the plain 16-hex-digit form
 * IEEE754Arithmetic.unpackHex expects.
 *
 * `format` is explicit ("decimal" or "hex"), set via the dropdown next to
 * the input — it is no longer guessed from the string's shape. That guess
 * was ambiguous: e.g. "12345678901234AB" reads as hex-looking, but a purely
 * numeric string like "1234567890123456" could just as easily have been
 * meant as decimal. The dropdown removes the ambiguity entirely.
 *
 * Throws with a readable message on invalid input.
 */
function operandToHex(raw, format) {
    const value = raw.trim();
    if (!value) throw new Error("missing operand");

    if (format === "hex") {
        if (!/^[0-9A-Fa-f]{16}$/.test(value)) {
            throw new Error(`"${value}" is not a valid 16-digit hex value`);
        }
        return value.toUpperCase();
    }

    // decimal
    if (typeof DecToDoubleConverter === "undefined") {
        throw new Error("decimal input requires DecToDoubleConverter.js");
    }
    let result;
    try {
        result = DecToDoubleConverter.convert(value);
    } catch (err) {
        // DecToDoubleConverter uses BigInt() internally, which throws its
        // own low-level error (e.g. "Cannot convert 12abc to a BigInt") on
        // malformed input — surface a message about the operand instead.
        throw new Error(`"${value}" is not a valid decimal number`);
    }
    if (!result || !result.hex || result.hex.length !== 16) {
        throw new Error(`"${value}" is not a valid decimal number`);
    }
    return result.hex;
}

// Event listener for arithmetic.html
document.addEventListener("DOMContentLoaded", () => {
    const operandA = document.getElementById("operandA");
    const operandAFormat = document.getElementById("operandAFormat");
    const operandB = document.getElementById("operandB");
    const operandBFormat = document.getElementById("operandBFormat");
    const operationSelect = document.getElementById("operationSelect");

    const stepsList = document.getElementById("stepsList");
    const finalBinary = document.getElementById("finalBinary");
    const finalHex = document.getElementById("finalHex");
    const finalDecimal = document.getElementById("finalDecimal");

    if (!operandA || !operandB) return; // not on this page

    // Renders each step as a compact table row: "Label" | "detail". Steps
    // are formatted "Label -> detail"; rows without a "->" (early-exit /
    // special-case messages) span the full row instead of splitting into
    // two columns.
    function renderSteps(lines) {
        stepsList.innerHTML = "";
        lines.forEach((line) => {
            const row = document.createElement("tr");

            const arrowIndex = line.indexOf(" -> ");
            if (arrowIndex === -1) {
                const cell = document.createElement("td");
                cell.className = "step-full";
                cell.colSpan = 2;
                cell.textContent = line;
                row.appendChild(cell);
            } else {
                const labelCell = document.createElement("td");
                labelCell.className = "step-label";
                labelCell.textContent = line.slice(0, arrowIndex);

                const detailCell = document.createElement("td");
                detailCell.className = "step-detail";
                detailCell.textContent = line.slice(arrowIndex + 4);

                row.appendChild(labelCell);
                row.appendChild(detailCell);
            }

            stepsList.appendChild(row);
        });
    }

    function clearOutputs() {
        stepsList.innerHTML = "";
        finalBinary.textContent = "";
        finalHex.textContent = "";
        finalDecimal.textContent = "";
    }

    function compute() {
        clearOutputs();

        // Nothing typed yet on one or both sides — stay quiet instead of erroring
        if (!operandA.value.trim() || !operandB.value.trim()) {
            return;
        }

        const formatA = operandAFormat ? operandAFormat.value : "decimal";
        const formatB = operandBFormat ? operandBFormat.value : "decimal";

        let hexA, hexB;
        try {
            hexA = operandToHex(operandA.value, formatA);
            hexB = operandToHex(operandB.value, formatB);
        } catch (err) {
            renderSteps([`Error: ${err.message}`]);
            return;
        }

        const op = operationSelect.value;
        const result = op === "multiply"
            ? IEEE754Arithmetic.multiply(hexA, hexB)
            : IEEE754Arithmetic.add(hexA, hexB);

        const opLabel = op === "multiply" ? "Multiplication" : "Addition";
        const intro = [
            `Operand A (${formatA}) -> hex ${hexA}`,
            `Operand B (${formatB}) -> hex ${hexB}`,
            `Operation: ${opLabel}`,
        ];
        renderSteps([...intro, ...result.steps]);

        finalBinary.textContent = result.final.binary;
        finalHex.textContent = result.final.hex;
        finalDecimal.textContent = String(result.final.decimal);
    }

    // Auto-compute as the user types, matching the converter and rounding pages
    ['input', 'change', 'keyup'].forEach((eventType) => {
        operandA.addEventListener(eventType, compute);
        operandB.addEventListener(eventType, compute);
    });
    operationSelect.addEventListener('change', compute);
    operandAFormat?.addEventListener('change', compute);
    operandBFormat?.addEventListener('change', compute);
});