using System;
using System.Configuration;

namespace StockVala.Gateway
{
    static class Config
    {
        // C#5-compatible: explicit get bodies instead of => expression members
        public static string MT5Server
        {
            get { return ConfigurationManager.AppSettings["MT5Server"]; }
        }
        public static string MT5Login
        {
            get { return ConfigurationManager.AppSettings["MT5Login"]; }
        }
        public static ulong MT5LoginId
        {
            get
            {
                var v = ConfigurationManager.AppSettings["MT5Login"];
                return v != null ? ulong.Parse(v) : 0UL;
            }
        }
        public static string MT5Password
        {
            get { return ConfigurationManager.AppSettings["MT5Password"]; }
        }
        public static string RedisHost
        {
            get { return ConfigurationManager.AppSettings["RedisHost"]; }
        }
        public static string RedisPassword
        {
            get { return ConfigurationManager.AppSettings["RedisPassword"]; }
        }
        public static int HttpPort
        {
            get
            {
                var v = ConfigurationManager.AppSettings["HttpPort"];
                int port;
                return (v != null && int.TryParse(v, out port)) ? port : 8081;
            }
        }
        // Default trading group used when creating accounts without explicit group
        public static string DefaultGroup
        {
            get
            {
                var v = ConfigurationManager.AppSettings["MT5DefaultGroup"];
                return !string.IsNullOrEmpty(v) ? v : "real\\clients";
            }
        }

        // Human-readable server name shown to clients (what they type in MT5 terminal)
        // Falls back to the raw IP:port if not configured
        public static string MT5ServerName
        {
            get
            {
                var v = ConfigurationManager.AppSettings["MT5ServerName"];
                return !string.IsNullOrEmpty(v) ? v : MT5Server;
            }
        }
    }
}
