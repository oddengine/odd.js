(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,

        INS = {
            ADC: 0,
            AND: 1,
            ASL: 2,
            BCC: 3,
            BCS: 4,
            BEQ: 5,
            BIT: 6,
            BMI: 7,
            BNE: 8,
            BPL: 9,
            BRK: 10,
            BVC: 11,
            BVS: 12,
            CLC: 13,
            CLD: 14,
            CLI: 15,
            CLV: 16,
            CMP: 17,
            CPX: 18,
            CPY: 19,
            DEC: 20,
            DEX: 21,
            DEY: 22,
            EOR: 23,
            INC: 24,
            INX: 25,
            INY: 26,
            JMP: 27,
            JSR: 28,
            LDA: 29,
            LDX: 30,
            LDY: 31,
            LSR: 32,
            NOP: 33,
            ORA: 34,
            PHA: 35,
            PHP: 36,
            PLA: 37,
            PLP: 38,
            ROL: 39,
            ROR: 40,
            RTI: 41,
            RTS: 42,
            SBC: 43,
            SEC: 44,
            SED: 45,
            SEI: 46,
            STA: 47,
            STX: 48,
            STY: 49,
            TAX: 50,
            TAY: 51,
            TSX: 52,
            TXA: 53,
            TXS: 54,
            TYA: 55,
            DUMMY: 56, // dummy instruction used for 'halting' the processor some cycles.
        },
        ADDR = {
            ZP: 0,
            REL: 1,
            IMP: 2,
            ABS: 3,
            ACC: 4,
            IMM: 5,
            ZPX: 6,
            ZPY: 7,
            ABSX: 8,
            ABSY: 9,
            PREIDXIND: 10,
            POSTIDXIND: 11,
            INDABS: 12,
        };

    function OpData() {
        var _this = this;

        function _init() {
            _this.opdata = new Array(256);

            // Set all to invalid instruction (to detect crashes).
            for (var i = 0; i < 256; i++) {
                _this.opdata[i] = 0xFF;
            }

            // Now fill in all valid opcodes.
            // ADC.
            _this.setOp(INS.ADC, 0x69, ADDR.IMM, 2, 2);
            _this.setOp(INS.ADC, 0x65, ADDR.ZP, 2, 3);
            _this.setOp(INS.ADC, 0x75, ADDR.ZPX, 2, 4);
            _this.setOp(INS.ADC, 0x6D, ADDR.ABS, 3, 4);
            _this.setOp(INS.ADC, 0x7D, ADDR.ABSX, 3, 4);
            _this.setOp(INS.ADC, 0x79, ADDR.ABSY, 3, 4);
            _this.setOp(INS.ADC, 0x61, ADDR.PREIDXIND, 2, 6);
            _this.setOp(INS.ADC, 0x71, ADDR.POSTIDXIND, 2, 5);

            // AND.
            _this.setOp(INS.AND, 0x29, ADDR.IMM, 2, 2);
            _this.setOp(INS.AND, 0x25, ADDR.ZP, 2, 3);
            _this.setOp(INS.AND, 0x35, ADDR.ZPX, 2, 4);
            _this.setOp(INS.AND, 0x2D, ADDR.ABS, 3, 4);
            _this.setOp(INS.AND, 0x3D, ADDR.ABSX, 3, 4);
            _this.setOp(INS.AND, 0x39, ADDR.ABSY, 3, 4);
            _this.setOp(INS.AND, 0x21, ADDR.PREIDXIND, 2, 6);
            _this.setOp(INS.AND, 0x31, ADDR.POSTIDXIND, 2, 5);

            // ASL.
            _this.setOp(INS.ASL, 0x0A, ADDR.ACC, 1, 2);
            _this.setOp(INS.ASL, 0x06, ADDR.ZP, 2, 5);
            _this.setOp(INS.ASL, 0x16, ADDR.ZPX, 2, 6);
            _this.setOp(INS.ASL, 0x0E, ADDR.ABS, 3, 6);
            _this.setOp(INS.ASL, 0x1E, ADDR.ABSX, 3, 7);

            // BCC.
            _this.setOp(INS.BCC, 0x90, ADDR.REL, 2, 2);

            // BCS.
            _this.setOp(INS.BCS, 0xB0, ADDR.REL, 2, 2);

            // BEQ.
            _this.setOp(INS.BEQ, 0xF0, ADDR.REL, 2, 2);

            // BIT.
            _this.setOp(INS.BIT, 0x24, ADDR.ZP, 2, 3);
            _this.setOp(INS.BIT, 0x2C, ADDR.ABS, 3, 4);

            // BMI.
            _this.setOp(INS.BMI, 0x30, ADDR.REL, 2, 2);

            // BNE.
            _this.setOp(INS.BNE, 0xD0, ADDR.REL, 2, 2);

            // BPL.
            _this.setOp(INS.BPL, 0x10, ADDR.REL, 2, 2);

            // BRK.
            _this.setOp(INS.BRK, 0x00, ADDR.IMP, 1, 7);

            // BVC.
            _this.setOp(INS.BVC, 0x50, ADDR.REL, 2, 2);

            // BVS.
            _this.setOp(INS.BVS, 0x70, ADDR.REL, 2, 2);

            // CLC.
            _this.setOp(INS.CLC, 0x18, ADDR.IMP, 1, 2);

            // CLD.
            _this.setOp(INS.CLD, 0xD8, ADDR.IMP, 1, 2);

            // CLI.
            _this.setOp(INS.CLI, 0x58, ADDR.IMP, 1, 2);

            // CLV.
            _this.setOp(INS.CLV, 0xB8, ADDR.IMP, 1, 2);

            // CMP.
            _this.setOp(INS.CMP, 0xC9, ADDR.IMM, 2, 2);
            _this.setOp(INS.CMP, 0xC5, ADDR.ZP, 2, 3);
            _this.setOp(INS.CMP, 0xD5, ADDR.ZPX, 2, 4);
            _this.setOp(INS.CMP, 0xCD, ADDR.ABS, 3, 4);
            _this.setOp(INS.CMP, 0xDD, ADDR.ABSX, 3, 4);
            _this.setOp(INS.CMP, 0xD9, ADDR.ABSY, 3, 4);
            _this.setOp(INS.CMP, 0xC1, ADDR.PREIDXIND, 2, 6);
            _this.setOp(INS.CMP, 0xD1, ADDR.POSTIDXIND, 2, 5);

            // CPX.
            _this.setOp(INS.CPX, 0xE0, ADDR.IMM, 2, 2);
            _this.setOp(INS.CPX, 0xE4, ADDR.ZP, 2, 3);
            _this.setOp(INS.CPX, 0xEC, ADDR.ABS, 3, 4);

            // CPY.
            _this.setOp(INS.CPY, 0xC0, ADDR.IMM, 2, 2);
            _this.setOp(INS.CPY, 0xC4, ADDR.ZP, 2, 3);
            _this.setOp(INS.CPY, 0xCC, ADDR.ABS, 3, 4);

            // DEC.
            _this.setOp(INS.DEC, 0xC6, ADDR.ZP, 2, 5);
            _this.setOp(INS.DEC, 0xD6, ADDR.ZPX, 2, 6);
            _this.setOp(INS.DEC, 0xCE, ADDR.ABS, 3, 6);
            _this.setOp(INS.DEC, 0xDE, ADDR.ABSX, 3, 7);

            // DEX.
            _this.setOp(INS.DEX, 0xCA, ADDR.IMP, 1, 2);

            // DEY.
            _this.setOp(INS.DEY, 0x88, ADDR.IMP, 1, 2);

            // EOR.
            _this.setOp(INS.EOR, 0x49, ADDR.IMM, 2, 2);
            _this.setOp(INS.EOR, 0x45, ADDR.ZP, 2, 3);
            _this.setOp(INS.EOR, 0x55, ADDR.ZPX, 2, 4);
            _this.setOp(INS.EOR, 0x4D, ADDR.ABS, 3, 4);
            _this.setOp(INS.EOR, 0x5D, ADDR.ABSX, 3, 4);
            _this.setOp(INS.EOR, 0x59, ADDR.ABSY, 3, 4);
            _this.setOp(INS.EOR, 0x41, ADDR.PREIDXIND, 2, 6);
            _this.setOp(INS.EOR, 0x51, ADDR.POSTIDXIND, 2, 5);

            // INC.
            _this.setOp(INS.INC, 0xE6, ADDR.ZP, 2, 5);
            _this.setOp(INS.INC, 0xF6, ADDR.ZPX, 2, 6);
            _this.setOp(INS.INC, 0xEE, ADDR.ABS, 3, 6);
            _this.setOp(INS.INC, 0xFE, ADDR.ABSX, 3, 7);

            // INX.
            _this.setOp(INS.INX, 0xE8, ADDR.IMP, 1, 2);

            // INY.
            _this.setOp(INS.INY, 0xC8, ADDR.IMP, 1, 2);

            // JMP.
            _this.setOp(INS.JMP, 0x4C, ADDR.ABS, 3, 3);
            _this.setOp(INS.JMP, 0x6C, ADDR.INDABS, 3, 5);

            // JSR.
            _this.setOp(INS.JSR, 0x20, ADDR.ABS, 3, 6);

            // LDA.
            _this.setOp(INS.LDA, 0xA9, ADDR.IMM, 2, 2);
            _this.setOp(INS.LDA, 0xA5, ADDR.ZP, 2, 3);
            _this.setOp(INS.LDA, 0xB5, ADDR.ZPX, 2, 4);
            _this.setOp(INS.LDA, 0xAD, ADDR.ABS, 3, 4);
            _this.setOp(INS.LDA, 0xBD, ADDR.ABSX, 3, 4);
            _this.setOp(INS.LDA, 0xB9, ADDR.ABSY, 3, 4);
            _this.setOp(INS.LDA, 0xA1, ADDR.PREIDXIND, 2, 6);
            _this.setOp(INS.LDA, 0xB1, ADDR.POSTIDXIND, 2, 5);


            // LDX.
            _this.setOp(INS.LDX, 0xA2, ADDR.IMM, 2, 2);
            _this.setOp(INS.LDX, 0xA6, ADDR.ZP, 2, 3);
            _this.setOp(INS.LDX, 0xB6, ADDR.ZPY, 2, 4);
            _this.setOp(INS.LDX, 0xAE, ADDR.ABS, 3, 4);
            _this.setOp(INS.LDX, 0xBE, ADDR.ABSY, 3, 4);

            // LDY.
            _this.setOp(INS.LDY, 0xA0, ADDR.IMM, 2, 2);
            _this.setOp(INS.LDY, 0xA4, ADDR.ZP, 2, 3);
            _this.setOp(INS.LDY, 0xB4, ADDR.ZPX, 2, 4);
            _this.setOp(INS.LDY, 0xAC, ADDR.ABS, 3, 4);
            _this.setOp(INS.LDY, 0xBC, ADDR.ABSX, 3, 4);

            // LSR.
            _this.setOp(INS.LSR, 0x4A, ADDR.ACC, 1, 2);
            _this.setOp(INS.LSR, 0x46, ADDR.ZP, 2, 5);
            _this.setOp(INS.LSR, 0x56, ADDR.ZPX, 2, 6);
            _this.setOp(INS.LSR, 0x4E, ADDR.ABS, 3, 6);
            _this.setOp(INS.LSR, 0x5E, ADDR.ABSX, 3, 7);

            // NOP.
            _this.setOp(INS.NOP, 0xEA, ADDR.IMP, 1, 2);

            // ORA.
            _this.setOp(INS.ORA, 0x09, ADDR.IMM, 2, 2);
            _this.setOp(INS.ORA, 0x05, ADDR.ZP, 2, 3);
            _this.setOp(INS.ORA, 0x15, ADDR.ZPX, 2, 4);
            _this.setOp(INS.ORA, 0x0D, ADDR.ABS, 3, 4);
            _this.setOp(INS.ORA, 0x1D, ADDR.ABSX, 3, 4);
            _this.setOp(INS.ORA, 0x19, ADDR.ABSY, 3, 4);
            _this.setOp(INS.ORA, 0x01, ADDR.PREIDXIND, 2, 6);
            _this.setOp(INS.ORA, 0x11, ADDR.POSTIDXIND, 2, 5);

            // PHA.
            _this.setOp(INS.PHA, 0x48, ADDR.IMP, 1, 3);

            // PHP.
            _this.setOp(INS.PHP, 0x08, ADDR.IMP, 1, 3);

            // PLA.
            _this.setOp(INS.PLA, 0x68, ADDR.IMP, 1, 4);

            // PLP.
            _this.setOp(INS.PLP, 0x28, ADDR.IMP, 1, 4);

            // ROL.
            _this.setOp(INS.ROL, 0x2A, ADDR.ACC, 1, 2);
            _this.setOp(INS.ROL, 0x26, ADDR.ZP, 2, 5);
            _this.setOp(INS.ROL, 0x36, ADDR.ZPX, 2, 6);
            _this.setOp(INS.ROL, 0x2E, ADDR.ABS, 3, 6);
            _this.setOp(INS.ROL, 0x3E, ADDR.ABSX, 3, 7);

            // ROR.
            _this.setOp(INS.ROR, 0x6A, ADDR.ACC, 1, 2);
            _this.setOp(INS.ROR, 0x66, ADDR.ZP, 2, 5);
            _this.setOp(INS.ROR, 0x76, ADDR.ZPX, 2, 6);
            _this.setOp(INS.ROR, 0x6E, ADDR.ABS, 3, 6);
            _this.setOp(INS.ROR, 0x7E, ADDR.ABSX, 3, 7);

            // RTI.
            _this.setOp(INS.RTI, 0x40, ADDR.IMP, 1, 6);

            // RTS.
            _this.setOp(INS.RTS, 0x60, ADDR.IMP, 1, 6);

            // SBC.
            _this.setOp(INS.SBC, 0xE9, ADDR.IMM, 2, 2);
            _this.setOp(INS.SBC, 0xE5, ADDR.ZP, 2, 3);
            _this.setOp(INS.SBC, 0xF5, ADDR.ZPX, 2, 4);
            _this.setOp(INS.SBC, 0xED, ADDR.ABS, 3, 4);
            _this.setOp(INS.SBC, 0xFD, ADDR.ABSX, 3, 4);
            _this.setOp(INS.SBC, 0xF9, ADDR.ABSY, 3, 4);
            _this.setOp(INS.SBC, 0xE1, ADDR.PREIDXIND, 2, 6);
            _this.setOp(INS.SBC, 0xF1, ADDR.POSTIDXIND, 2, 5);

            // SEC.
            _this.setOp(INS.SEC, 0x38, ADDR.IMP, 1, 2);

            // SED.
            _this.setOp(INS.SED, 0xF8, ADDR.IMP, 1, 2);

            // SEI.
            _this.setOp(INS.SEI, 0x78, ADDR.IMP, 1, 2);

            // STA.
            _this.setOp(INS.STA, 0x85, ADDR.ZP, 2, 3);
            _this.setOp(INS.STA, 0x95, ADDR.ZPX, 2, 4);
            _this.setOp(INS.STA, 0x8D, ADDR.ABS, 3, 4);
            _this.setOp(INS.STA, 0x9D, ADDR.ABSX, 3, 5);
            _this.setOp(INS.STA, 0x99, ADDR.ABSY, 3, 5);
            _this.setOp(INS.STA, 0x81, ADDR.PREIDXIND, 2, 6);
            _this.setOp(INS.STA, 0x91, ADDR.POSTIDXIND, 2, 6);

            // STX.
            _this.setOp(INS.STX, 0x86, ADDR.ZP, 2, 3);
            _this.setOp(INS.STX, 0x96, ADDR.ZPY, 2, 4);
            _this.setOp(INS.STX, 0x8E, ADDR.ABS, 3, 4);

            // STY.
            _this.setOp(INS.STY, 0x84, ADDR.ZP, 2, 3);
            _this.setOp(INS.STY, 0x94, ADDR.ZPX, 2, 4);
            _this.setOp(INS.STY, 0x8C, ADDR.ABS, 3, 4);

            // TAX.
            _this.setOp(INS.TAX, 0xAA, ADDR.IMP, 1, 2);

            // TAY.
            _this.setOp(INS.TAY, 0xA8, ADDR.IMP, 1, 2);

            // TSX.
            _this.setOp(INS.TSX, 0xBA, ADDR.IMP, 1, 2);

            // TXA.
            _this.setOp(INS.TXA, 0x8A, ADDR.IMP, 1, 2);

            // TXS.
            _this.setOp(INS.TXS, 0x9A, ADDR.IMP, 1, 2);

            // TYA.
            _this.setOp(INS.TYA, 0x98, ADDR.IMP, 1, 2);

            _this.cycTable = new Array(
                /*0x00*/ 7, 6, 2, 8, 3, 3, 5, 5, 3, 2, 2, 2, 4, 4, 6, 6,
                /*0x10*/ 2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
                /*0x20*/ 6, 6, 2, 8, 3, 3, 5, 5, 4, 2, 2, 2, 4, 4, 6, 6,
                /*0x30*/ 2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
                /*0x40*/ 6, 6, 2, 8, 3, 3, 5, 5, 3, 2, 2, 2, 3, 4, 6, 6,
                /*0x50*/ 2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
                /*0x60*/ 6, 6, 2, 8, 3, 3, 5, 5, 4, 2, 2, 2, 5, 4, 6, 6,
                /*0x70*/ 2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
                /*0x80*/ 2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,
                /*0x90*/ 2, 6, 2, 6, 4, 4, 4, 4, 2, 5, 2, 5, 5, 5, 5, 5,
                /*0xA0*/ 2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,
                /*0xB0*/ 2, 5, 2, 5, 4, 4, 4, 4, 2, 4, 2, 4, 4, 4, 4, 4,
                /*0xC0*/ 2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,
                /*0xD0*/ 2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
                /*0xE0*/ 2, 6, 3, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,
                /*0xF0*/ 2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7
            );

            // Instruction Names.
            _this.instname = new Array(56);
            _this.instname[0] = "ADC";
            _this.instname[1] = "AND";
            _this.instname[2] = "ASL";
            _this.instname[3] = "BCC";
            _this.instname[4] = "BCS";
            _this.instname[5] = "BEQ";
            _this.instname[6] = "BIT";
            _this.instname[7] = "BMI";
            _this.instname[8] = "BNE";
            _this.instname[9] = "BPL";
            _this.instname[10] = "BRK";
            _this.instname[11] = "BVC";
            _this.instname[12] = "BVS";
            _this.instname[13] = "CLC";
            _this.instname[14] = "CLD";
            _this.instname[15] = "CLI";
            _this.instname[16] = "CLV";
            _this.instname[17] = "CMP";
            _this.instname[18] = "CPX";
            _this.instname[19] = "CPY";
            _this.instname[20] = "DEC";
            _this.instname[21] = "DEX";
            _this.instname[22] = "DEY";
            _this.instname[23] = "EOR";
            _this.instname[24] = "INC";
            _this.instname[25] = "INX";
            _this.instname[26] = "INY";
            _this.instname[27] = "JMP";
            _this.instname[28] = "JSR";
            _this.instname[29] = "LDA";
            _this.instname[30] = "LDX";
            _this.instname[31] = "LDY";
            _this.instname[32] = "LSR";
            _this.instname[33] = "NOP";
            _this.instname[34] = "ORA";
            _this.instname[35] = "PHA";
            _this.instname[36] = "PHP";
            _this.instname[37] = "PLA";
            _this.instname[38] = "PLP";
            _this.instname[39] = "ROL";
            _this.instname[40] = "ROR";
            _this.instname[41] = "RTI";
            _this.instname[42] = "RTS";
            _this.instname[43] = "SBC";
            _this.instname[44] = "SEC";
            _this.instname[45] = "SED";
            _this.instname[46] = "SEI";
            _this.instname[47] = "STA";
            _this.instname[48] = "STX";
            _this.instname[49] = "STY";
            _this.instname[50] = "TAX";
            _this.instname[51] = "TAY";
            _this.instname[52] = "TSX";
            _this.instname[53] = "TXA";
            _this.instname[54] = "TXS";
            _this.instname[55] = "TYA";

            _this.addrDesc = new Array(
                "Zero Page           ",
                "Relative            ",
                "Implied             ",
                "Absolute            ",
                "Accumulator         ",
                "Immediate           ",
                "Zero Page,X         ",
                "Zero Page,Y         ",
                "Absolute,X          ",
                "Absolute,Y          ",
                "Preindexed Indirect ",
                "Postindexed Indirect",
                "Indirect Absolute   "
            );
        }

        _this.setOp = function (inst, op, addr, size, cycles) {
            _this.opdata[op] =
                ((inst & 0xFF)) |
                ((addr & 0xFF) << 8) |
                ((size & 0xFF) << 16) |
                ((cycles & 0xFF) << 24);
        };

        _init();
    }

    OpData.INS = INS;
    OpData.ADDR = ADDR;
    CPU.OpData = OpData;
})(odd);

