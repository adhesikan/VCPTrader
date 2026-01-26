import { Snaptrade } from "snaptrade-typescript-sdk";

let snaptradeClient: Snaptrade | null = null;

export function getSnaptradeClient(): Snaptrade | null {
  if (!snaptradeClient) {
    const clientId = process.env.SNAPTRADE_CLIENT_ID;
    const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;

    if (!clientId || !consumerKey) {
      console.warn("SnapTrade credentials not configured");
      return null;
    }

    snaptradeClient = new Snaptrade({
      clientId,
      consumerKey,
    });
  }

  return snaptradeClient;
}

export function isSnaptradeConfigured(): boolean {
  return !!(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY);
}

export interface SnaptradeUserRegistration {
  userId: string;
  userSecret: string;
}

export async function registerSnaptradeUser(internalUserId: string): Promise<SnaptradeUserRegistration | null> {
  const client = getSnaptradeClient();
  if (!client) return null;

  try {
    const response = await client.authentication.registerSnapTradeUser({
      userId: internalUserId,
    });

    return {
      userId: response.data.userId || internalUserId,
      userSecret: response.data.userSecret || "",
    };
  } catch (error: any) {
    if (error.response?.status === 409) {
      console.log("SnapTrade user already exists for:", internalUserId);
      return null;
    }
    console.error("Failed to register SnapTrade user:", error);
    throw error;
  }
}

export interface AuthLinkOptions {
  broker?: string;
  connectionType?: "read" | "trade";
  customRedirect?: string;
  reconnect?: string;
}

export async function getSnaptradeAuthLink(
  snaptradeUserId: string,
  userSecret: string,
  options: AuthLinkOptions = {}
): Promise<string | null> {
  const client = getSnaptradeClient();
  if (!client) return null;

  try {
    const response = await client.authentication.loginSnapTradeUser({
      userId: snaptradeUserId,
      userSecret: userSecret,
      broker: options.broker,
      connectionType: options.connectionType || "trade",
      customRedirect: options.customRedirect,
      reconnect: options.reconnect,
      immediateRedirect: true,
    });

    const data = response.data as any;
    return data.redirectURI || data.loginRedirectURI || data.redirect_uri || null;
  } catch (error) {
    console.error("Failed to get SnapTrade auth link:", error);
    throw error;
  }
}

export interface SnaptradeAccount {
  id: string;
  brokerageAuthorizationId: string;
  brokerName: string;
  name: string;
  number: string;
  type: string;
  syncStatus?: string;
}

export async function getSnaptradeAccounts(
  snaptradeUserId: string,
  userSecret: string
): Promise<SnaptradeAccount[]> {
  const client = getSnaptradeClient();
  if (!client) return [];

  try {
    const response = await client.accountInformation.listUserAccounts({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });
    
    return (response.data || []).map((account: any) => {
      // Try multiple paths to get the broker name
      const brokerName = account.brokerage?.name 
        || account.brokerage_name 
        || account.meta?.brokerage?.name
        || "Unknown";
      
      return {
        id: account.id || "",
        brokerageAuthorizationId: account.brokerage_authorization_id || account.brokerageAuthorizationId || "",
        brokerName,
        name: account.name || "",
        number: account.number || "",
        type: account.type?.type || account.account_type || "Unknown",
        syncStatus: account.sync_status?.status || "synced",
      };
    });
  } catch (error) {
    console.error("Failed to get SnapTrade accounts:", error);
    throw error;
  }
}

export interface SnaptradeHolding {
  symbol: string;
  units: number;
  price: number;
  value: number;
  currency: string;
}

export async function getSnaptradeHoldings(
  snaptradeUserId: string,
  userSecret: string,
  accountId?: string
): Promise<SnaptradeHolding[]> {
  const client = getSnaptradeClient();
  if (!client) return [];

  try {
    const params: any = {
      userId: snaptradeUserId,
      userSecret: userSecret,
    };
    if (accountId) {
      params.accounts = accountId;
    }
    
    const response = await client.accountInformation.getAllUserHoldings(params);

    const holdings: SnaptradeHolding[] = [];
    
    if (Array.isArray(response.data)) {
      for (const accountHoldings of response.data) {
        const positions = accountHoldings.positions || [];
        for (const position of positions) {
          holdings.push({
            symbol: position.symbol?.symbol?.symbol || position.symbol?.id || "Unknown",
            units: position.units || 0,
            price: position.price || 0,
            value: (position.units || 0) * (position.price || 0),
            currency: position.currency?.code || "USD",
          });
        }
      }
    }

    return holdings;
  } catch (error) {
    console.error("Failed to get SnapTrade holdings:", error);
    throw error;
  }
}

export interface SnaptradeBalance {
  currency: string;
  cash: number;
  buyingPower?: number;
}

export async function getSnaptradeBalance(
  snaptradeUserId: string,
  userSecret: string,
  accountId: string
): Promise<SnaptradeBalance[]> {
  const client = getSnaptradeClient();
  if (!client) return [];

  try {
    const response = await client.accountInformation.getUserAccountBalance({
      userId: snaptradeUserId,
      userSecret: userSecret,
      accountId: accountId,
    });

    return (response.data || []).map((balance: any) => ({
      currency: balance.currency?.code || "USD",
      cash: balance.cash || 0,
      buyingPower: balance.buying_power || balance.buyingPower,
    }));
  } catch (error) {
    console.error("Failed to get SnapTrade balance:", error);
    throw error;
  }
}

export interface SnaptradeOrderRequest {
  accountId: string;
  symbol: string;
  action: "BUY" | "SELL";
  orderType: "Market" | "Limit" | "Stop" | "StopLimit";
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: "Day" | "GTC" | "FOK" | "IOC";
}

export interface SnaptradeOrderResponse {
  orderId: string;
  status: string;
  symbol: string;
  action: string;
  quantity: number;
  filledQuantity?: number;
  price?: number;
  avgFillPrice?: number;
}

export async function placeSnaptradeOrder(
  snaptradeUserId: string,
  userSecret: string,
  order: SnaptradeOrderRequest
): Promise<SnaptradeOrderResponse | null> {
  const client = getSnaptradeClient();
  if (!client) return null;

  try {
    const symbolResponse = await client.referenceData.symbolSearchUserAccount({
      userId: snaptradeUserId,
      userSecret: userSecret,
      accountId: order.accountId,
      substring: order.symbol,
    });

    const symbolData = symbolResponse.data as any[];
    const matchingSymbol = (symbolData || []).find(
      (s: any) => s.symbol?.symbol === order.symbol || s.symbol === order.symbol
    );

    if (!matchingSymbol) {
      throw new Error(`Symbol ${order.symbol} not found in account`);
    }

    const universalSymbolId = matchingSymbol.id || matchingSymbol.symbol?.id;

    const orderParams: any = {
      userId: snaptradeUserId,
      userSecret: userSecret,
      accountId: order.accountId,
      action: order.action,
      orderType: order.orderType,
      timeInForce: order.timeInForce || "Day",
      universalSymbolId: universalSymbolId,
      units: order.quantity,
    };

    if (order.price && (order.orderType === "Limit" || order.orderType === "StopLimit")) {
      orderParams.price = order.price;
    }

    if (order.stopPrice && (order.orderType === "Stop" || order.orderType === "StopLimit")) {
      orderParams.stop = order.stopPrice;
    }

    const response = await client.trading.placeOrder(orderParams);

    const orderData = response.data;
    
    return {
      orderId: orderData?.brokerage_order_id || orderData?.id || "pending",
      status: orderData?.status || "submitted",
      symbol: order.symbol,
      action: order.action,
      quantity: order.quantity,
      filledQuantity: orderData?.filled_quantity || orderData?.filledQuantity,
      price: order.price,
      avgFillPrice: orderData?.execution_price || orderData?.executionPrice,
    };
  } catch (error) {
    console.error("Failed to place SnapTrade order:", error);
    throw error;
  }
}

export async function deleteSnaptradeUser(
  snaptradeUserId: string
): Promise<boolean> {
  const client = getSnaptradeClient();
  if (!client) return false;

  try {
    await client.authentication.deleteSnapTradeUser({
      userId: snaptradeUserId,
    });
    return true;
  } catch (error) {
    console.error("Failed to delete SnapTrade user:", error);
    return false;
  }
}

export async function listSnaptradeAuthorizations(
  snaptradeUserId: string,
  userSecret: string
): Promise<any[]> {
  const client = getSnaptradeClient();
  if (!client) return [];

  try {
    const response = await client.connections.listBrokerageAuthorizations({
      userId: snaptradeUserId,
      userSecret: userSecret,
    });

    return response.data || [];
  } catch (error) {
    console.error("Failed to list SnapTrade authorizations:", error);
    throw error;
  }
}

export async function removeSnaptradeAuthorization(
  snaptradeUserId: string,
  userSecret: string,
  authorizationId: string
): Promise<boolean> {
  const client = getSnaptradeClient();
  if (!client) return false;

  try {
    await client.connections.removeBrokerageAuthorization({
      userId: snaptradeUserId,
      userSecret: userSecret,
      authorizationId: authorizationId,
    });
    return true;
  } catch (error) {
    console.error("Failed to remove SnapTrade authorization:", error);
    return false;
  }
}

export async function getSupportedBrokers(): Promise<any[]> {
  const client = getSnaptradeClient();
  if (!client) return [];

  try {
    const response = await client.referenceData.listAllBrokerages();
    return (response.data || []).filter((broker: any) => broker.isActive !== false);
  } catch (error) {
    console.error("Failed to get supported brokers:", error);
    return [];
  }
}
