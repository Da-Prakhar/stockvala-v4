using System;

namespace StockVala.Gateway
{
    class Program
    {
        static int Main(string[] args)
        {
            Console.WriteLine("[StockVala Gateway] Starting...");

            var app = new GatewayApp();

            if (!app.Start())
            {
                Console.WriteLine("[StockVala Gateway] Failed to start.");
                return 1;
            }

            Console.WriteLine("[StockVala Gateway] Running. Press Ctrl+C to stop.");

            // Keep alive until Ctrl+C
            Console.CancelKeyPress += (s, e) => {
                e.Cancel = true;
                app.Stop();
            };

            app.Wait();

            Console.WriteLine("[StockVala Gateway] Stopped.");
            return 0;
        }
    }
}
