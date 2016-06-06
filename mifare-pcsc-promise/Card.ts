///<reference path="../typings/modules/bluebird/index.d.ts"/>

import {byteFromTwoHex, DEFAULT_END_ACS, KEY_TYPE_A, KEY_TYPE_B, KeyType} from './common';
import * as Promise from 'bluebird';

function makeStandardCardPromise(promise: Promise<Buffer>): Promise<void> {
	return promise
		.then(data => {
			switch(data.toString('hex')) {
				case '9000':
					return null;
				case '6300':
					throw new Error('Failed command');
				default:
					throw new Error(`Undefined data: ${data.toString('hex')}`);
			}
		});
}

function makeReaderCardPromise(promise: Promise<Buffer>): Promise<Buffer> {
	return promise
		.then(data => {
			switch(data.slice(data.length - 2).toString('hex')) {
				case '9000':
					return data.slice(0, data.length - 2);
				case '6300':
					throw new Error('Failed command');
				default:
					throw new Error(`Undefined data: ${data.toString('hex')}`);
			}
		});
}

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
		return makeReaderCardPromise(this.reader.transmitAsync(new Buffer([0xFF, 0xCA, 0, 0, 0]), 6, this.protocol));
	}

	public loadAuthKey(authKeyNumber: number, key: Buffer): Promise<void> {
		if (authKeyNumber < 0 || authKeyNumber > 0x20) throw new Error("Key Number is out of range");
		if (key.length !== 6) throw new Error("Key length should be 6");
		const buff = Buffer.concat([
			new Buffer([0xFF, 0x82, (authKeyNumber === 0x20) ? 0x20 : 0, authKeyNumber, 6]),
			new Buffer(key),
		]);
		return makeStandardCardPromise(this.reader.transmitAsync(buff, 2, this.protocol));
	}
	
	public authenticate(blockNumber: number, keyType: KeyType, authKeyNumber: number): Promise<void> {
		if (keyType !== KeyType.A && keyType !== KeyType.B) throw new Error("Wrong key type");
		if (blockNumber < 0 || blockNumber > 0x3F) throw new Error("Block out of range");
		if (authKeyNumber < 0 || authKeyNumber > 0x20) throw new Error("Key Number out of range");
		return makeStandardCardPromise(this.reader.transmitAsync(
			new Buffer([0xFF, 0x86, 0, 0, 5, 1, 0, blockNumber, keyType, authKeyNumber]), 2, this.protocol
		));
	}
	
	public readBlock(blockNumber: number, length: number): Promise<Buffer> {
		if (blockNumber < 0 || blockNumber > 0x3F) throw new Error("Block out of range");
		if (length !== 0x10 && length !== 0x20 && length !== 0x30) throw new Error("Bad length");
		return makeReaderCardPromise(this.reader.transmitAsync(
			new Buffer([0xFF, 0xB0, 0, blockNumber, length]), length + 2, this.protocol
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
		return makeStandardCardPromise(this.reader.transmitAsync(buff, 2, this.protocol));
	}

	public restoreBlock(src: number, dest: number): Promise<void> {
		if (src < 0 || src > 0x3F) throw new Error("Source block out of range");
		if (dest < 0 || dest > 0x3F) throw new Error("Destination block out of range");
		if (((src / 4) | 0) !== ((dest / 4) | 0)) throw new Error("Blocks are not in the same sector");
		return makeStandardCardPromise(this.reader.transmitAsync(
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