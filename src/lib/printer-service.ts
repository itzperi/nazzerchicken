export interface PrinterDevice {
  id: string;
  name: string;
  type: 'bluetooth' | 'network' | 'system';
  connected: boolean;
}

class PrinterService {
  private connectedDevice: any = null;
  private characteristic: any = null;

  public isConnected(): boolean {
    return !!this.characteristic;
  }

  /**
   * Detect available Bluetooth Thermal Printers using Web Bluetooth API
   */
  async scanBluetoothPrinters(): Promise<PrinterDevice[]> {
    const navigatorAny = navigator as any;
    if (!navigatorAny.bluetooth) {
      console.error('Web Bluetooth is not supported in this browser.');
      return [];
    }

    try {
      const device = await navigatorAny.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common thermal printer service
          { namePrefix: 'TP' },
          { namePrefix: 'MPT' },
          { namePrefix: 'Printer' }
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      return [{
        id: device.id,
        name: device.name || 'Unknown Printer',
        type: 'bluetooth',
        connected: false
      }];
    } catch (error) {
      console.log('User cancelled or connection failed:', error);
      return [];
    }
  }

  /**
   * Connect to a specific Bluetooth device
   */
  async connect(deviceId: string): Promise<boolean> {
    try {
      // requestDevice must be triggered by user gesture, so this usually happens in scan.
      // For this simplified service, we assume the device was just picked.
      if (!this.connectedDevice) return false;

      const server = await this.connectedDevice.gatt?.connect();
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristics = await service?.getCharacteristics();

      // Look for write characteristic
      this.characteristic = characteristics?.find(c => c.properties.write || c.properties.writeWithoutResponse) || null;

      return !!this.characteristic;
    } catch (error) {
      console.error('Failed to connect to printer:', error);
      return false;
    }
  }

  /**
   * Print raw text to the connected thermal printer
   */
  async printRaw(content: string): Promise<void> {
    if (!this.characteristic) {
      // Fallback to system print if no bluetooth printer is connected
      this.printViaSystem(content);
      return;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(content + '\n\n\n'); // Add some padding for manual tearing
    await this.characteristic.writeValue(data);
  }

  /**
   * Standard system print fallback
   */
  async printViaSystem(content: string, title: string = 'Bill'): Promise<void> {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please disable popup blocker to print.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
            body { 
              font-family: 'Roboto', sans-serif; 
              font-weight: 700;
              padding: 20px; 
              line-height: 1.4;
              margin: 0;
            }
            pre { 
              white-space: pre-wrap; 
              font-size: 14px;
              margin: 0;
              font-family: 'Roboto', sans-serif;
              font-weight: 700;
            }
            @media print {
              body { padding: 10px; }
              pre { font-size: 12px; }
            }
          </style>
        </head>
        <body>
          <pre>${content}</pre>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                // Close after printing on mobile for better UX
                if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                   // Mobile browsers handle window closure differently after print
                }
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}

export const printerService = new PrinterService();
