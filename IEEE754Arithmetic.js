/**
 * IEEE 754 Double Precision (64-bit) Arithmetic Module
 * Uses BigInt for precise bitwise manipulation to simulate hardware-level GRS logic.
 */
class IEEE754Arithmetic {
    
    // Constants for 64-bit Double Precision
    static BIAS = 1023n;
    static FRACTION_BITS = 52n;
    static HIDDEN_BIT = 1n << 52n; 

    /**
     * Unpacks a 64-bit hex string into Sign, Exponent, and Mantissa (with hidden bit).
     * @param {string} hexStr - The 16-character hexadecimal string (e.g., "C029400000000000")
     * @returns {Object} Unpacked components using BigInt
     */
    static unpackHex(hexStr) {
        const num = BigInt("0x" + hexStr);
        const sign = num >> 63n;
        const exp = (num >> this.FRACTION_BITS) & 0x7FFn;
        let mantissa = num & ((1n << this.FRACTION_BITS) - 1n);

        // Add hidden bit for normalized numbers
        if (exp > 0n && exp < 2047n) {
            mantissa = mantissa | this.HIDDEN_BIT;
        }

        return { sign, exp, mantissa };
    }

    /**
     * Packs Sign, Exponent, and Mantissa back into a 64-bit Hex and Binary string.
     */
    static pack(sign, exp, mantissa) {
        // Remove hidden bit
        const fraction = mantissa & ((1n << this.FRACTION_BITS) - 1n);
        const result = (sign << 63n) | (exp << this.FRACTION_BITS) | fraction;
        
        let binaryStr = result.toString(2).padStart(64, '0');
        // Format with proper spacing: Sign(1) Exponent(11) Fraction(52)
        const spacedBinary = `${binaryStr.slice(0, 1)} ${binaryStr.slice(1, 12)} ${binaryStr.slice(12)}`;
        const hexStr = result.toString(16).toUpperCase().padStart(16, '0');

        return {
            binary: spacedBinary,
            hex: hexStr,
            // Note: For true decimal output, you would pass the hex back into a DataView/Float64Array.
            decimal: this.hexToFloat64(hexStr) 
        };
    }

    static hexToFloat64(hex) {
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        // Split 64-bit hex into two 32-bit halves for DataView compatibility
        view.setUint32(0, parseInt(hex.substring(0, 8), 16));
        view.setUint32(4, parseInt(hex.substring(8, 16), 16));
        return view.getFloat64(0);
    }

    /**
     * Performs Multiplication using GRS.
     * @param {string} hexA - Operand A in Hex
     * @param {string} hexB - Operand B in Hex
     */
    static multiply(hexA, hexB) {
        const steps = [];
        const opA = this.unpackHex(hexA);
        const opB = this.unpackHex(hexB);

        steps.push(`Step 1: Unpacked Operands.`);
        
        // 1. Determine Sign
        const resultSign = opA.sign ^ opB.sign;
        steps.push(`Step 2: Calculate Sign -> ${opA.sign} XOR ${opB.sign} = ${resultSign}`);

        // 2. Add Exponents
        let resultExp = opA.exp + opB.exp - this.BIAS;
        steps.push(`Step 3: Calculate Exponent -> ${opA.exp} + ${opB.exp} - 1023 = ${resultExp}`);

        // 3. Multiply Mantissas (53 bits * 53 bits = 106 bits)
        let product = opA.mantissa * opB.mantissa;
        steps.push(`Step 4: Multiply Mantissas (Yields 106-bit product).`);

        // 4. Normalize and Extract GRS
        // The radix point is between bit 104 and 105.
        // Highest possible bit for 53x53 is bit 105.
        let isNormalized = (product & (1n << 105n)) !== 0n;
        
        if (isNormalized) {
            resultExp += 1n;
            steps.push(`Step 5: Normalization -> Product MSB is 1. Increment exponent to ${resultExp}.`);
        } else {
            // Shift product left to align it as if bit 105 is the MSB
            product = product << 1n;
            steps.push(`Step 5: Normalization -> Product shifted left by 1.`);
        }

        // 5. Calculate GRS Bits
        // The top 53 bits (105 down to 53) are the new mantissa
        let newMantissa = product >> 53n;
        
        // Bit 52 is Guard
        const G = (product >> 52n) & 1n;
        // Bit 51 is Round
        const R = (product >> 51n) & 1n;
        // Bits 50 to 0 make the Sticky bit
        const stickyMask = (1n << 51n) - 1n;
        const S = (product & stickyMask) > 0n ? 1n : 0n;

        steps.push(`Step 6: GRS Extraction -> Guard: ${G}, Round: ${R}, Sticky: ${S}`);

        // 6. Rounding (Round to Nearest, Ties to Even)
        if (G === 1n && (R === 1n || S === 1n || (newMantissa & 1n) === 1n)) {
            newMantissa += 1n;
            steps.push(`Step 7: Rounding -> Rounding up applied.`);
            
            // Handle overflow during rounding
            if ((newMantissa & (1n << 53n)) !== 0n) {
                newMantissa = newMantissa >> 1n;
                resultExp += 1n;
                steps.push(`Step 7.1: Overflow during rounding, shifted right and incremented exponent.`);
            }
        } else {
            steps.push(`Step 7: Rounding -> Truncated (No rounding up needed).`);
        }

        // 7. Pack and return
        const finalFormat = this.pack(resultSign, resultExp, newMantissa);
        return { operation: "Multiplication", steps, final: finalFormat };
    }

    /**
     * Performs Addition using GRS alignment.
     */
    static add(hexA, hexB) {
        const steps = [];
        const opA = this.unpackHex(hexA);
        const opB = this.unpackHex(hexB);
        
        steps.push(`Step 1: Unpacked Operands.`);

        // Determine which operand has the larger exponent
        let larger, smaller;
        if (opA.exp > opB.exp || (opA.exp === opB.exp && opA.mantissa >= opB.mantissa)) {
            larger = opA; smaller = opB;
        } else {
            larger = opB; smaller = opA;
        }

        const expDiff = larger.exp - smaller.exp;
        steps.push(`Step 2: Exponent alignment. Difference = ${expDiff}. Shifting smaller mantissa.`);

        // Shift smaller mantissa right and calculate GRS
        let G = 0n, R = 0n, S = 0n;
        let alignedMantissa = smaller.mantissa;

        if (expDiff > 0n) {
            // Shift amount safely clamped to 55 to prevent massive bitwise shifts
            let shiftAmt = expDiff > 55n ? 55n : expDiff;
            
            // Calculate bits shifted out
            const shiftedOut = alignedMantissa & ((1n << shiftAmt) - 1n);
            alignedMantissa = alignedMantissa >> shiftAmt;

            // Extract GRS from the shifted out portion
            G = (shiftedOut >> (shiftAmt - 1n)) & 1n;
            R = shiftAmt > 1n ? (shiftedOut >> (shiftAmt - 2n)) & 1n : 0n;
            const stickyMask = (1n << (shiftAmt - 2n)) - 1n;
            S = (shiftedOut & stickyMask) > 0n ? 1n : 0n;
        }

        steps.push(`Step 3: GRS generated during alignment -> Guard: ${G}, Round: ${R}, Sticky: ${S}`);

        // Note: For a complete implementation, you must handle Addition vs Subtraction here 
        // based on `opA.sign == opB.sign`. The below strictly adds the aligned mantissas.
        
        let resultMantissa = larger.mantissa + alignedMantissa;
        let resultExp = larger.exp;
        let resultSign = larger.sign; // simplified assumption for addition of same signs
        
        steps.push(`Step 4: Added Mantissas.`);

        // Normalize if overflowed (result is 54 bits instead of 53)
        if ((resultMantissa & (1n << 53n)) !== 0n) {
            // Shift right, recalculate GRS
            S = S | R;
            R = G;
            G = resultMantissa & 1n;
            resultMantissa = resultMantissa >> 1n;
            resultExp += 1n;
            steps.push(`Step 5: Normalization -> Overflow detected. Shifted right. New G=${G}, R=${R}, S=${S}`);
        } else {
            steps.push(`Step 5: Normalization -> Already normalized.`);
        }

        // Round-to-nearest ties-to-even
        if (G === 1n && (R === 1n || S === 1n || (resultMantissa & 1n) === 1n)) {
            resultMantissa += 1n;
            steps.push(`Step 6: Rounding -> Rounding up applied.`);
             if ((resultMantissa & (1n << 53n)) !== 0n) {
                resultMantissa = resultMantissa >> 1n;
                resultExp += 1n;
             }
        } else {
            steps.push(`Step 6: Rounding -> Truncated (No rounding up needed).`);
        }

        const finalFormat = this.pack(resultSign, resultExp, resultMantissa);
        return { operation: "Addition", steps, final: finalFormat };
    }
}

// === EXAMPLE USAGE ===
// Convert Decimal to Hex first using an external library or standard JS Buffer, 
// then pass the Hex strings into this module.

// 1.5 (Hex: 3FF8000000000000) * 2.0 (Hex: 4000000000000000)
const mulResult = IEEE754Arithmetic.multiply("3FF8000000000000", "4000000000000000");
console.log(mulResult);
