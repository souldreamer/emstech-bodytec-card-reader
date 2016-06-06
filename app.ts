///<reference path="./typings/globals/node/index.d.ts"/>
///<reference path="./typings/modules/bluebird/index.d.ts"/>

import * as mifare from './mifare-pcsc-promise';
import * as Promise from 'bluebird';

mifare.onCard((card: mifare.Card) => {
	card
		.getUID()
		.then((uid: Buffer) => {
			let promise: Promise<any> = card.loadAuthKey(0, Buffer.concat([uid, new Buffer([0x4D, 0x42])]));
			for (let block = 0; block < 0x3B; block++) {
				if ((block + 1) % 4 === 0) continue;
				promise = promise
					.then(_ => card.authenticate(block, mifare.KeyType.B, 0))
					.catch(err => console.error(`Authentication error: ${err}`))
					.then(_ => card.readBlock(block, 0x10))
					.then((data: Buffer) => console.log(block.toString(16), data))
					.catch(err => console.error(`Data read error: ${err}`));
			}
		})
		.catch((err: any) => console.error('Could not get UID. Error: ', err));
}, true);