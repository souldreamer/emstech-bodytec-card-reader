///<reference path="../typings/modules/bluebird/index.d.ts"/>

/****************************************************************************
 * Information on PC/SC commands:
 * http://www.pcscworkgroup.com/specifications/files/pcsc3_v2.01.09.pdf
 * http://www.pcscworkgroup.com/specifications/files/pcsc3_v2.01.09_sup.pdf
 * http://www.pcscworkgroup.com/specifications/files/pcsc3_v2.01.09_amd1.pdf
 ****************************************************************************/

import * as Promise from 'bluebird';
import {byteFromTwoHex, DEFAULT_END_ACS, KeyType} from './common';
import {
	handlePCSCOperationReturn,
	handlePCSCReadOperationReturn
} from './handle-return-buffer';

interface ACS {
	c1: number;
	c2: number;
	c3: number;
}

interface Trailer {
	acs: ACS;
	keyA: Buffer;
	keyB: Buffer;
}

export class Card {
	public reader: any;
	constructor(reader: any, public protocol: any) {
		this.reader = Promise.promisifyAll(reader, {context: reader});
	}
	
	public getUID(): Promise<Buffer> {
		return handlePCSCReadOperationReturn(this.reader.transmitAsync(
			new Buffer([0xFF, 0xCA, 0x00, 0x00, 0x00]), 6, this.protocol
		));
	}

	// if authKeyNumber is 0x20 (32), then the key is loaded in non-volatile memory
	public loadAuthKey(authKeyNumber: number, key: Buffer): Promise<void> {
		if (authKeyNumber < 0 || authKeyNumber > 0x20) throw new Error("Key Number is out of range");
		if (key.length !== 6) throw new Error("Key length should be 6");
		const buff = Buffer.concat([
			new Buffer([0xFF, 0x82, (authKeyNumber === 0x20) ? 0x20 : 0, authKeyNumber, 6]),
			new Buffer(key),
		]);
		return handlePCSCOperationReturn(this.reader.transmitAsync(buff, 2, this.protocol));
	}
	
	public authenticate(blockNumber: number, keyType: KeyType, authKeyNumber: number): Promise<void> {
		if (authKeyNumber < 0 || authKeyNumber > 0x20) throw new Error("Key Number out of range");
		return handlePCSCOperationReturn(this.reader.transmitAsync(
			new Buffer([0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, blockNumber>>8, blockNumber%256, keyType, authKeyNumber]), 2, this.protocol
		));
	}
	
	public readBlock(blockNumber: number, _length: number = 0x10): Promise<Buffer> {
		let length = 0x10; // different length isn't working for some reason
		return handlePCSCReadOperationReturn(this.reader.transmitAsync(
			new Buffer([0xFF, 0xB0, blockNumber>>8, blockNumber%256, length]), length + 2, this.protocol
		));
	}

	// EXPERIMENTAL -- TOTALLY NOT WORKING
	public readTag(): Promise<Buffer> {
		return handlePCSCReadOperationReturn(this.reader.transmitAsync(
			new Buffer([0xFF, 0xB0, 0x00, 0x00, 0x00, 0x00]), 2, this.protocol
		));
	}

	public updateBlock(blockNumber: number, newData: Buffer): Promise<void> {
		if (blockNumber < 0 || blockNumber > 0x3F) throw new Error("Block out of range");
		if (newData.length !== 0x10 && newData.length !== 0x20 && newData.length !== 0x30) {
			throw new Error("Bad length");
		}
		const buff = Buffer.concat([
			new Buffer([0xFF, 0xD6, 0, blockNumber, newData.length]),
			new Buffer(newData),
		]);
		return handlePCSCOperationReturn(this.reader.transmitAsync(buff, 2, this.protocol));
	}

	public restoreBlock(src: number, dest: number): Promise<void> {
		if (src < 0 || src > 0x3F) throw new Error("Source block out of range");
		if (dest < 0 || dest > 0x3F) throw new Error("Destination block out of range");
		if (((src / 4) | 0) !== ((dest / 4) | 0)) throw new Error("Blocks are not in the same sector");
		return handlePCSCOperationReturn(this.reader.transmitAsync(
			new Buffer([0xFF, 0xD7, 0, src, 2, 3, dest]), 2, this.protocol
		));
	}

	/************* Utility methods *************/
	static packACS({c1, c2, c3}: ACS): Buffer {
		if (c1 < 0 || c1 > 0xF) throw new Error('C1 is out of range');
		if (c2 < 0 || c2 > 0xF) throw new Error('C2 is out of range');
		if (c3 < 0 || c3 > 0xF) throw new Error('C3 is out of range');
		return new Buffer([
			byteFromTwoHex(~c2, ~c1),
			byteFromTwoHex(c1, ~c3),
			byteFromTwoHex(c3, c2),
			DEFAULT_END_ACS,
		]);
	}

	static unpackACS(data: Buffer): ACS {
		if (data.length !== 4) throw new Error("Buffer length is wrong");
		return {
			c1: (data[1] & 0xF0) >> 4,
			c2: data[2] & 0xF,
			c3: (data[2] & 0xF0) >> 4,
		};
	}

	static packTrailer({keyA, keyB, acs: {c1, c2, c3}}: Trailer): Buffer {
		if (keyA.length !== 6) throw new Error("KEY A length is wrong");
		if (keyB.length !== 6) throw new Error("KEY B length is wrong");
		return Buffer.concat([
			new Buffer(keyA),
			Card.packACS({c1, c2, c3}),
			new Buffer(keyB),
		]);
	}

	static unpackTrailer(data: Buffer): Trailer {
		if (data.length !== 16) throw new Error("Buffer length is wrong");
		return {
			keyA: data.slice(0, 6),
			acs: Card.unpackACS(data.slice(6, 10)),
			keyB: data.slice(10, 16),
		};
	}
}