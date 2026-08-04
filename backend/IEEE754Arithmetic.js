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
        const opA = this.unpackHex(hexA);
        const opB = this.unpackHex(hexB);
        
        steps.push(`Step 1: Unpacked Operands.`);
        
        // 1. Determine Sign
        const resultSign = opA.sign ^ opB.sign;
        steps.push(`Step 2: Calculate Sign -> ${opA.sign} XOR ${opB.sign} = ${resultSign}`);

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

        // 3. Multiply Mantissas
        let product = opA.mantissa * opB.mantissa;
        let isNormalized = (product & (1n << 105n)) !== 0n;
        
        if (isNormalized) {
            resultExp += 1n;
        } else {
            product = product << 1n;
        }

        // 4. Calculate GRS Bits
        let newMantissa = product >> 53n;
        const G = (product >> 52n) & 1n;
        const R = (product >> 51n) & 1n;
        const stickyMask = (1n << 51n) - 1n;
        const S = (product & stickyMask) > 0n ? 1n : 0n;

        // 5. Rounding
        if (G === 1n && (R === 1n || S === 1n || (newMantissa & 1n) === 1n)) {
            newMantissa += 1n;
            if ((newMantissa & (1n << 53n)) !== 0n) {
                newMantissa = newMantissa >> 1n;
                resultExp += 1n;
            }
        }

        if (resultExp >= 2047n) {
            steps.push("Step 7: Exponent Overflow -> Returning Infinity");
            return { operation: "Multiplication", steps, final: this.getSpecialCasePack("Infinity", resultSign) };
        }
        if (resultExp <= 0n) {
            steps.push(`Step 7: Exponent Underflow (${resultExp}) -> Normalizing to Subnormal`);
            const shiftAmt = 1n - resultExp;
            // Shift mantissa down to adjust for subnormal range
            newMantissa = newMantissa >> (shiftAmt > 54n ? 54n : shiftAmt); 
            resultExp = 0n;
        }

        const finalFormat = this.pack(resultSign, resultExp, newMantissa);
        return { operation: "Multiplication", steps, final: finalFormat };
    }

    /**
     * Performs Addition (and Subtraction) using GRS alignment.
     */
    static add(hexA, hexB) {
        const steps = [];
        const opA = this.unpackHex(hexA);
        const opB = this.unpackHex(hexB);
        
        steps.push(`Step 1: Unpacked Operands.`);

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
        }

        let resultMantissa;
        let resultExp = larger.exp;

        if (opA.sign === opB.sign) {
            // Standard Addition
            steps.push(`Step 3: Same signs detected. Adding mantissas.`);
            resultMantissa = larger.mantissa + alignedMantissa;
            
            // Normalize overflow
            if ((resultMantissa & (1n << 53n)) !== 0n) {
                S = S | R; R = G; G = resultMantissa & 1n;
                resultMantissa = resultMantissa >> 1n;
                resultExp += 1n;
            }
        } else {
            // Mixed Sign Subtraction
            steps.push(`Step 3: Differing signs detected. Subtracting smaller mantissa from larger.`);
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

            // Total cancellation mapping to +0
            if (resultMantissa === 0n && G === 0n && R === 0n && S === 0n) {
                return { operation: "Addition (Subtraction)", steps: ["Exact cancellation to 0"], final: this.pack(0n, 0n, 0n) };
            }

            // Normalize Subtraction Result (Shift left to restore hidden bit)
            while ((resultMantissa & this.HIDDEN_BIT) === 0n && resultExp > 0n) {
                resultMantissa = (resultMantissa << 1n) | G;
                G = R; R = S; S = 0n; // Cycle bits up
                resultExp -= 1n;
            }
        }

        // Round-to-nearest ties-to-even
        if (G === 1n && (R === 1n || S === 1n || (resultMantissa & 1n) === 1n)) {
            resultMantissa += 1n;
             if ((resultMantissa & (1n << 53n)) !== 0n) {
                resultMantissa = resultMantissa >> 1n;
                resultExp += 1n;
             }
        }

        if (resultExp >= 2047n) {
            return { operation: "Addition", steps: ["Exponent Overflow -> Infinity"], final: this.getSpecialCasePack("Infinity", resultSign) };
        }
        if (resultExp <= 0n && resultMantissa !== 0n) {
            resultExp = 0n; // Set Biased Exponent for Subnormal
        }

        const finalFormat = this.pack(resultSign, resultExp, resultMantissa);
        return { operation: "Addition", steps, final: finalFormat };
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const hexInputA = document.getElementById('hexInputA');
    const hexInputB = document.getElementById('hexInputB');
    const operationSelect = document.getElementById('operationSelect');
    const floatOutput = document.getElementById('floatOutput');
    
    const signBitOutput = document.getElementById('signBitOutput');
    const exponentBitsOutput = document.getElementById('exponentBitsOutput');
    const mantissaBitsOutput = document.getElementById('mantissaBitsOutput');

    const signAnalysisOutput = document.getElementById('signAnalysisOutput');
    const exponentAnalysisOutput = document.getElementById('exponentAnalysisOutput');
    const mantissaAnalysisOutput = document.getElementById('mantissaAnalysisOutput');

    function handleArithmetic() {
        const hexA = hexInputA.value.trim();
        const hexB = hexInputB.value.trim();
        const operation = operationSelect.value;

        if (!hexA || !hexB) {
            floatOutput.value = "";
            signBitOutput.textContent = "";
            exponentBitsOutput.textContent = "";
            mantissaBitsOutput.textContent = "";
            signAnalysisOutput.textContent = "";
            exponentAnalysisOutput.textContent = "";
            mantissaAnalysisOutput.textContent = "";
            return;
        }

        try {
            let result;
            if (operation === "multiply") {
                result = IEEE754Arithmetic.multiply(hexA, hexB);
            } else {
                result = IEEE754Arithmetic.add(hexA, hexB);
            }

            if (result && result.final) {
                floatOutput.value = result.final.hex;

                const parts = result.final.binary.split(" ");
                signBitOutput.textContent = parts[0] || "";
                exponentBitsOutput.textContent = parts[1] || "";
                mantissaBitsOutput.textContent = parts[2] || "";

                signAnalysisOutput.textContent = `Result Sign Bit: ${parts[0]}`;
                exponentAnalysisOutput.textContent = `Biased Exponent: ${parts[1]}`;
                
                let stepLog = result.steps ? result.steps.join("\n") : "";
                mantissaAnalysisOutput.textContent = `Decimal Value: ${result.final.decimal}\n\nSteps:\n${stepLog}`;
            }
        } catch (e) {
            floatOutput.value = "Error (Invalid Hex)";
        }
    }

    hexInputA.addEventListener('input', handleArithmetic);
    hexInputB.addEventListener('input', handleArithmetic);
    operationSelect.addEventListener('change', handleArithmetic);
});