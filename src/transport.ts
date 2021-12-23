import { EventEmitter } from 'events';

import IGrpcTransport from '@huddly/sdk-interfaces/lib/interfaces/IGrpcTransport';
import HuddlyDevice from './networkdevice';

/**
 * Currently depicted as a dummy transport to conform with the structure of the
 * other device-api-* modules. The actual transport will take place on the device
 * manager implementation for the IP cameras.
 *
 * @class GrpcTransport
 * @implements {IGrpcTransport, EventEmitter}
 */
export default class GrpcTransport extends EventEmitter implements IGrpcTransport {
    grpcConnectionDeadlineSeconds: number;
    grpcClient: any;
    device: any;

    constructor(device: HuddlyDevice) {
        super();
        this.device = device;
    }

    overrideGrpcClient(client: any): void {
        this.grpcClient = client;
    }

    init(): Promise<void> {
        return Promise.resolve();
    }
    close(): Promise<any> {
        return Promise.resolve();
    }
}
