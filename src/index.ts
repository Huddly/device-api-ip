import IHuddlyDeviceAPI from '@huddly/sdk/lib/src/interfaces/iHuddlyDeviceAPI';
import { EventEmitter } from 'events';
import IUVCControlAPI from '@huddly/sdk/lib/src/interfaces/iUVCControlApi';
import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import DeviceApiOpts from '@huddly/sdk/lib/src/interfaces/IDeviceApiOpts';
import DeviceDiscoveryManager from './manager';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import HuddlyDevice from './networkdevice';
import GrpcTransport from './transport';
import IGrpcTransport from '@huddly/sdk/lib/src/interfaces/IGrpcTransport';

export default class HuddlyDeviceApiIP implements IHuddlyDeviceAPI {
    logger: any;
    eventEmitter: EventEmitter;
    deviceDiscoveryManager: DeviceDiscoveryManager;
    maxSearchRetries: Number;
    alwaysRetry: boolean;

    private readonly SUPPORTED_DEVICES: String[] = ['L1'];

    constructor(opts: DeviceApiOpts = {}) {
        this.logger = opts.logger || new Logger(true);
        this.deviceDiscoveryManager = opts.manager || new DeviceDiscoveryManager(this.logger);
        this.maxSearchRetries = opts.maxSearchRetries || 10;
        this.alwaysRetry = opts.alwaysRetry || false;
    }

    async initialize() {}

    registerForHotplugEvents(eventEmitter: EventEmitter): void {
        this.eventEmitter = eventEmitter;
        this.deviceDiscoveryManager.registerForHotplugEvents(eventEmitter);
    }

    async getDeviceDiscoveryAPI(): Promise<IDeviceDiscovery> {
        return this.deviceDiscoveryManager;
    }

    async getValidatedTransport(device: HuddlyDevice): Promise<IGrpcTransport> {
        if (device && (device.manufacturer != 'Huddly' || !this.SUPPORTED_DEVICES.includes(device.name))) {
            this.logger.warn(`There is no supported transport implementation for device ${device.name} from manufacturer ${device.manufacturer}`, HuddlyDeviceApiIP.name);
            return undefined;
        }

        try {
            const transport = await this.getTransport(device);
            // TODO: some sort of handshake ?
            return transport;
        } catch (e) { // TODO: catch specific exception™
            this.logger.error(`GRPC Transport implementation not supported for device ${device.toString()}`, e, HuddlyDeviceApiIP.name);
        }
    }

    async getTransport(device: HuddlyDevice): Promise<GrpcTransport> {
        const transport = new GrpcTransport(device, this.logger);
        await transport.init();
        return transport;
    }

    async isUVCControlsSupported(_: any) {
        return Promise.resolve(false);
    }

    async getUVCControlAPIForDevice(_: any): Promise<IUVCControlAPI> {
        throw new Error('UVCControlInterface API not supported for network/ip cameras');
    }

    async isHIDSupported(_: any) {
        return Promise.resolve(false);
    }

    async getHIDAPIForDevice(_: any): Promise<any> {
        throw new Error('HID not supported for network/ip cameras');
    }
}
