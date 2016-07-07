///<reference path="./typings/globals/node/index.d.ts"/>
///<reference path="./typings/modules/bluebird/index.d.ts"/>

import * as mifare from './mifare-pcsc-promise';
import * as Promise from 'bluebird';
import * as fs from 'fs';

let index = 1;

mifare.onCard((card: mifare.Card) => {
	card
		.getUID()
		.then((uid: Buffer) => {
			let information: Buffer = new Buffer([]);
			let promise: Promise<any> = card.loadAuthKey(0, Buffer.concat([uid, new Buffer([0x4D, 0x42])]));
			for (let block = 0; block < 0x3B; block++) {
				if ((block + 1) % 4 === 0) continue;
				promise = promise
					.then(_ => card.authenticate(block, mifare.KeyType.B, 0))
					.catch(err => console.error(`Authentication error: ${err}`))
					.then(_ => card.readBlock(block, 0x10))
					.then((data: Buffer) => {
						information = Buffer.concat([information, data]);
						console.log(block.toString(16), data)
					})
					.catch(err => console.error(`Data read error: ${err}`));
			}*/
			//promise = promise.then(_ => card.loadAuthKey(1, new Buffer([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])));
			let step = 1;
			for (let block = 0; block < 0x3C; block += step) {
				promise = promise
					.then(_ => card.authenticate(block, mifare.KeyType.B, keyLocation))
					.catch(err => {
						console.error(`Authentication error: ${err}`);
						return card.authenticate(block, mifare.KeyType.B, 1);
					})
					.then(_ => card.readBlock(block, step << 4))
					.then(data => console.log(data.toString('hex')))
					.catch(err => console.error(err.message));
			}
			promise = promise
				.then(_ => {
					console.log(`Writing file ${index}`);
					let writeStream = fs.createWriteStream(`card-${index}.mfd`);
					writeStream.write(information);
					writeStream.end();
					index++;
				});
		})
		.catch((err: any) => console.error('Could not get UID. Error: ', err));
}, true);