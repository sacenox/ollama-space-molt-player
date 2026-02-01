// World information panel (left bottom) - base services and market

import type { Base, MarketListing } from "../../../client/src/types";
import { applyBold, applyColor, COLORS } from "../colors";
import { formatLine, truncate } from "../utils";

export interface WorldInfoData {
	base: Base | null;
	maxMarketItems?: number;
}

export function renderWorldInfoPanel(data: WorldInfoData): string {
	const lines: string[] = [];

	if (!data.base) {
		return applyColor("Not docked", COLORS.STATUS_INACTIVE);
	}

	// Base info
	lines.push(applyColor(applyBold("== Base =="), COLORS.PANEL_TITLE));
	lines.push(
		formatLine("Name", data.base.name || data.base.id, COLORS.PANEL_LABEL),
	);

	if (data.base.empire) {
		lines.push(formatLine("Empire", data.base.empire, COLORS.PANEL_LABEL));
	}

	lines.push("");

	// Services
	lines.push(applyColor(applyBold("Services"), COLORS.PANEL_LABEL));
	const services = data.base.services;
	const serviceList: string[] = [];

	if (services.market) serviceList.push(formatService("Market", true));
	if (services.refuel) serviceList.push(formatService("Refuel", true));
	if (services.repair) serviceList.push(formatService("Repair", true));
	if (services.shipyard) serviceList.push(formatService("Shipyard", true));
	if (services.crafting) serviceList.push(formatService("Crafting", true));
	if (services.missions) serviceList.push(formatService("Missions", true));
	if (services.storage) serviceList.push(formatService("Storage", true));
	if (services.cloning) serviceList.push(formatService("Cloning", true));
	if (services.insurance) serviceList.push(formatService("Insurance", true));

	if (serviceList.length === 0) {
		lines.push(applyColor("  none", COLORS.STATUS_INACTIVE));
	} else {
		for (const service of serviceList) {
			lines.push(`  ${service}`);
		}
	}

	// Market
	if (services.market && data.base.market && data.base.market.length > 0) {
		lines.push("");
		lines.push(applyColor(applyBold("Market"), COLORS.PANEL_LABEL));

		const maxItems = data.maxMarketItems ?? 8;
		const items = data.base.market.slice(0, maxItems);

		for (const listing of items) {
			const itemLine = formatMarketListing(listing);
			lines.push(itemLine);
		}

		if (data.base.market.length > maxItems) {
			const remaining = data.base.market.length - maxItems;
			lines.push(
				applyColor(`  +${remaining} more items`, COLORS.STATUS_INACTIVE),
			);
		}
	}

	return lines.join("\n");
}

function formatService(name: string, available: boolean): string {
	if (available) {
		return applyColor(`✓ ${name}`, COLORS.STATUS_SAFE);
	}
	return applyColor(`✗ ${name}`, COLORS.STATUS_INACTIVE);
}

function formatMarketListing(listing: MarketListing): string {
	const itemId = truncate(listing.item_id, 12);
	const price = listing.price_each.toLocaleString();
	const qty = listing.quantity;
	return `  ${itemId} ${applyColor(`${price}cr`, COLORS.PANEL_VALUE)} x${qty}`;
}
