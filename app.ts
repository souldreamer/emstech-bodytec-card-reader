///<reference path="./typings/globals/node/index.d.ts"/>
///<reference path="./typings/modules/bluebird/index.d.ts"/>

import * as mifare from './mifare-pcsc-promise';
import * as Promise from 'bluebird';

mifare.onCard((card: mifare.Card) => {
	card
		.getUID()
		.then((uid: Buffer) => {
			let keyLocation = 0;
			let promise: Promise<any> = Promise.resolve();//card.loadAuthKey(keyLocation, Buffer.concat([uid, new Buffer([0x4D, 0x42])]));
			/*
			for (let block = 0; block < 0x3C; block++) {
				if ((block + 1) % 4 === 0) continue;
				promise = promise
					.then(_ => card.authenticate(block, mifare.KeyType.B, 0))
					.catch(err => console.error(`Authentication error: ${err}`))
					.then(_ => card.readBlock(block, 0x10))
					.then((data: Buffer) => console.log(block.toString(16), data))
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
		})
		.catch((err: any) => console.error('Could not get UID. Error: ', err));
}, true);