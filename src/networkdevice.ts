export default class HuddlyDevice {
    name: String;
    mac: String;
    ip: String;
    serialNumber: String;
    types: String[];
    scopes: String[];
    xaddrs: String;
    modelName: String;
    manufacturer: String;
    metadataVersion: String;
    messageId: String;
    productId: number;

    constructor(deviceData: any = {}) {
        this.name = deviceData.name;
        this.mac = deviceData.mac;
        this.ip = deviceData.ip;
        this.serialNumber = deviceData.serialNumber;
        this.types = deviceData.types;
        this.scopes = deviceData.scopes;
        this.xaddrs = deviceData.xaddrs;
        this.modelName = deviceData.modelName;
        this.manufacturer = deviceData.manufacturer;
        this.metadataVersion = deviceData.metadataVersion;
        this.messageId = deviceData.messageId;
    }

    toString(): String {
        const deviceStringRep = [];
        deviceStringRep.push(
            `Name: ${this.name || 'Unknown'} |`,
            `Manufactorer: ${this.manufacturer || 'Unknown'} |`,
            `Serial: ${this.serialNumber || 'Unknown'} |`,
            `MAC Address: ${this.mac || 'Unknown'} |`,
            `IPv4 Address: ${this.ip || 'Unknown'}`
        );
        return deviceStringRep.join(' ');
    }

    equals(device: HuddlyDevice): boolean {
        if (device != undefined) {
            if (device.mac != undefined && this.mac != undefined) {
                return device.mac == this.mac;
            }
            if (device.serialNumber != undefined && this.serialNumber != undefined) {
                return device.serialNumber == this.serialNumber;
            }
            if (device.ip != undefined && this.ip != undefined) {
                return device.ip == this.ip;
            }
        }
        return false;
    }
}
