///<reference path="../typings/modules/bluebird/index.d.ts"/>
import {bufferEndsWith} from './common';
import * as Promise from 'bluebird';

const OPERATION_OK_ENDING = new Buffer([0x90, 0x00]);
const OPERATION_FAILED_ENDING = new Buffer([0x63, 0x00]);

const OperationType = {
	LOAD_KEYS: 'Load Keys',
	GENERAL_AUTHENTICATE: 'General Authenticate',
	READ_BINARY: 'Read Binary',
	GET_DATA: 'Get Data',
	COMMON: 'Common'
};
type IOperationType =
	'Load Keys' |
	'General Authenticate' |
	'Read Binary' |
	'Get Data' |
	'Common';

const OPERATION_ERRORS = {
	'Common': {
		0x63: {
			0x00: 'WARNING: No information is given.',
		},
		0x67: {
			0x00: 'ERROR: Wrong length.'
		},
		0x68: {
			0x00: 'ERROR: Class byte is not correct.'
		},
		0x6A: {
			0x81: 'ERROR: Function not supported.'
		},
		0x6B: {
			0x00: 'ERROR: Wrong parameter P1-P2.'
		}
	},
	'Get Data': {
		0x62: {
			0x82: 'WARNING: End of data reached before Le bytes (Le is greater than data length).'
		},
		0x6C: {
			'XX': (XX) => `ERROR: Wrong length (wrong number Le: ${XX}); Le is less than the available UID length.`
		}
	},
	'Load Keys': {
		0x63: {
			0x00: 'WARNING: No information is given.',
		},
		0x69: {
			0x82: 'ERROR: Card key not supported.',
			0x83: 'ERROR: Reader key not supported.',
			0x84: 'ERROR: Plain transmission not supported.',
			0x85: 'ERROR: Secured transmission not supported.',
			0x86: 'ERROR: Volatile memory is not available.',
			0x87: 'ERROR: Non volatile memory is not available.',
			0x88: 'ERROR: Key number not valid.',
			0x89: 'ERROR: Key length is not correct.',
		}
	},
	'General Authenticate': {
		0x63: {
			0x00: 'WARNING: No information is given.',
		},
		0x65: {
			0x81: 'ERROR: Memory failure, block addressed by blockNumber parameter does not exist.'
		},
		0x69: {
			0x82: 'ERROR: Security status not satisfied.',
			0x83: 'ERROR: Authentication cannot be done.',
			0x84: 'ERROR: Reference key not usable.',
			0x86: 'ERROR: Key type not known.',
			0x88: 'ERROR: Key number not valid.',
		}
	},
	'Read binary': {
		0x62: {
			0x81: 'WARNING: Part of returned data may be corrupted.',
			0x82: 'WARNING: End of file reached before reading expected number of bytes.'
		},
		0x69: {
			0x81: 'ERROR: Command incompatible.',
			0x82: 'ERROR: Security status not satisfied.',
			0x86: 'ERROR: Command not allowed.'
		},
		0x6A: {
			0x81: 'ERROR: Function not supported.',
			0x82: 'ERROR: File not found / Addressed block or byte does not exist.'
		},
		0x6C: {
			'XX': (XX) => `ERROR: Wrong length (wrong number Le: ${XX}).`
		}
	}
};
let commonErrors = OPERATION_ERRORS['Common'];

function getErrorMessage(nl: number, le: number, operationType: IOperationType): string {
	let message: any = '';

	if (commonErrors) {
		if (commonErrors[nl]) {
			if (commonErrors[nl][le]) {
				message = commonErrors[nl][le];
			} else if (commonErrors[nl].XX) {
				message = commonErrors[nl].XX(le);
			}
		}
	}
	let operationTypeErrors = OPERATION_ERRORS[operationType];
	if (operationTypeErrors) {
		if (operationTypeErrors[nl]) {
			if (operationTypeErrors[nl][le]) {
				message = operationTypeErrors[nl][le];
			} else if (operationTypeErrors[nl].XX) {
				message = operationTypeErrors[nl].XX(le);
			}
		}
	}
	if (!message) message = 'ERROR: unknown.';
	return message;
}

export function handlePCSCOperationReturn(promise: Promise<Buffer>, operationType: IOperationType = 'Common'): Promise<void> {
	return promise
		.then(data => {
			if (bufferEndsWith(data, OPERATION_OK_ENDING)) return;
			let nl = data[data.length-2], le = data[data.length-1]; // next to last and last element
			throw new Error(`${getErrorMessage(nl, le, operationType)}\nDATA: ${data.toString('hex')}`);
		});
}

export function handlePCSCReadOperationReturn(promise: Promise<Buffer>, operationType: IOperationType = 'Common'): Promise<Buffer> {
	return promise
		.then(data => {
			if (bufferEndsWith(data, OPERATION_OK_ENDING)) return data.slice(0, data.length - 2);
			let nl = data[data.length-2], le = data[data.length-1]; // next to last and last element
			throw new Error(`${getErrorMessage(nl, le, operationType)}\nDATA: ${data.toString('hex')}`);
		});
}
