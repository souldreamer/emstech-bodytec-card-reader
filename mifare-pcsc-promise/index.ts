/***********************************************************************************
 * Based on https://github.com/gossel-j/node-mifare-pcsc/
 * This is the TypeScript/promisified version, as the original code somehow
 * eschewed my attempts to promisify it using `bluebird.promisifyAll()` so I
 * just ended up rewriting it. Plus, now I have types, too. =)
 *
 * Side-note: avoid the original's callback hell, come to the Promise dark-side :D
 ***********************************************************************************/

import {Card} from './Card';

const pcscLite = require("pcsclite");

let PCSC = null;

interface OnCardCallback {
	(card: Card): void;
}

const getPCSC = () => PCSC = PCSC || pcscLite();
export const onCard = (cb: OnCardCallback, debug: boolean = false) => {
	const pcsc = getPCSC();
	const log = (debug) ? console.log : () => {};

	pcsc.on("reader", (reader) => {
		log(`New Reader(${ reader.name })`);

		reader.on("status", (status) => {
			const changes = reader.state ^ status.state;

			if (changes) {
				if (changes & status.state & reader.SCARD_STATE_EMPTY) {
					log(`Reader(${ reader.name }) card removed`);
					reader.disconnect(reader.SCARD_LEAVE_CARD, (err) => {
						if (err) {
							log(`Reader(${ reader.name }) error on disconnect ${ err }`);
						} else {
							log(`Reader(${ reader.name }) card disconnected`);
						}
					});
				} else if (changes & status.state & reader.SCARD_STATE_PRESENT) {
					log(`Reader(${ reader.name }) card inserted`);
					setTimeout(() => {
						reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (err, protocol) => {
							if (err) {
								log(`Reader(${ reader.name }) error on connect ${ err }`);
							} else {
								cb(new Card(reader, protocol));
							}
						});
					}, 20);
				}
			}
		});

		reader.on('end', () => log(`Remove Reader(${ reader.name })`));

		reader.on('error', (err) => log(`Error Reader(${ reader.name }): ${ err.message }`));
	});

	pcsc.on("error", (err) => log(`PCSC error: ${ err.message }`));
};

export * from './common';
export * from './Card';
