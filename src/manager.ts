import IDeviceDiscovery from '@huddly/sdk/lib/src/interfaces/iDeviceDiscovery';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import { EventEmitter } from 'stream';
import HuddlyDevice from './networkdevice';
import WsDiscovery from './wsdiscovery';

export default class DeviceDiscoveryManager implements IDeviceDiscovery {
    private discoveredDevices: HuddlyDevice[] = [];
    private wsdd: WsDiscovery;
    eventEmitter: EventEmitter;
    logger: any;
    pollInterval: any;
    pollIntervalMs: number = 5000;

    // When you want the list directly without going through probe discovery.
    get pairedDevices(): HuddlyDevice[] {
        return this.discoveredDevices;
    }

    constructor(opts: any = {}, wsdd: WsDiscovery = undefined) {
        this.pollIntervalMs = opts.pollInterval || 5000;
        this.logger = opts.logger || new Logger(true);
        this.wsdd = wsdd || new WsDiscovery(this.logger, { timeout: 1000 });
        this.discoveredDevices = opts.preDiscoveredDevices || [];
    }

    registerForHotplugEvents(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
        this.setupProbePoke();
    }

    listExcept(listA: HuddlyDevice[], listB: HuddlyDevice[]): HuddlyDevice[] {
        const result: HuddlyDevice[] = []; // final
        for (let i = 0; i < listA.length; i++) {
            let found = false;
            for (let j = 0; j < listB.length && !found; j++) {
                if (listA[i].equals(listB[j])) {
                    found = true;
                }
            }
            if (!found) {
                result.push(listA[i]);
            }
        }
        return result;
    }

    probeHandler(deviceList: HuddlyDevice[]): void {
        // Find which devices have been detached
        const detachedDevices: HuddlyDevice[] = this.listExcept(this.discoveredDevices, deviceList);
        // Emit detach event for all devices in the above list
        for (let i = 0; i < detachedDevices.length; i++) {
            this.logger.info(
                `Huddly ${detachedDevices[i].name} camera with [Serial: ${detachedDevices[i].serialNumber}, MAC: ${detachedDevices[i].mac}] not available any longer`,
                DeviceDiscoveryManager.name
            );
            if (this.eventEmitter) {
                this.eventEmitter.emit('DETACH', detachedDevices[i]);
            }
        }
        // Find which devices have been newly discovered
        const newDevices: HuddlyDevice[] = this.listExcept(deviceList, this.discoveredDevices);
        // Emit attach event for all devices in the above list
        for (let i = 0; i < newDevices.length; i++) {
            this.logger.info(
                `Found new Huddly ${newDevices[i].name} camera with [Serial: ${newDevices[i].serialNumber}, MAC: ${newDevices[i].mac}] available at ${newDevices[i].ip}`,
                DeviceDiscoveryManager.name
            );
            if (this.eventEmitter) {
                this.eventEmitter.emit('ATTACH', newDevices[i]);
            }
        }
        const stillAlive: HuddlyDevice[] = this.listExcept(this.discoveredDevices, detachedDevices);
        // Discovered Devices list now represents the new cameras plus the existing ones still available (i.e. stillAlive + newDevices)
        this.discoveredDevices = stillAlive.concat(newDevices);
    }

    setupProbePoke(): void {
        this.wsdd.probe((deviceList: HuddlyDevice[]) => this.probeHandler(deviceList));
        this.pollInterval = setInterval(() => {
            this.wsdd.probe((deviceList: HuddlyDevice[]) => this.probeHandler(deviceList));
        }, this.pollIntervalMs); // Poke every 5 seconds
    }

    destroy(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = undefined;
        }
        this.wsdd.close();
    }

    deviceList(): Promise<HuddlyDevice[]> {
        return new Promise(resolve => {
            this.wsdd.probe((deviceList: HuddlyDevice[]) => {
                // TODO: should we reject promise where there are no devices discoverd?
                resolve(deviceList);
            });
        });
    }

    getDevice(serialNumber: string = undefined): Promise<HuddlyDevice | undefined> {
        return new Promise((resolve, reject) => {
            this.wsdd.probe((deviceList: HuddlyDevice[]) => {
                if (serialNumber) {
                    this.logger.debug(
                        `Filtering the devices for the following serial number: ${serialNumber}`,
                        DeviceDiscoveryManager.name
                    );
                    const matchedDevice: HuddlyDevice = deviceList.find(
                        d => d.serialNumber === serialNumber
                    );
                    if (matchedDevice) {
                        resolve(matchedDevice);
                        return;
                    }
                } else if (deviceList.length > 0) {
                    this.logger.debug(
                        `Choosing the first discovered device from the list as the serial number is not provided`,
                        DeviceDiscoveryManager.name
                    );
                    resolve(deviceList[0]);
                    return;
                }

                const msg: string = `Could not find device with serial ${serialNumber} amongst ${deviceList.length} devices!`;
                this.logger.warn(msg, DeviceDiscoveryManager.name);
                reject(msg);
            });
        });
    }
}
