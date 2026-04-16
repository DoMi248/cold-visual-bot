const { DATA_FILES } = require("../config");
const { readJsonFile, writeJsonFile } = require("./fileHandler");

const DEFAULT_PRODUCTS = [
    {
        id: "kleidung-basic",
        label: "Kleidung Basic",
        price: 9.99
    },
    {
        id: "kleidung-premium",
        label: "Kleidung Premium",
        price: 19.99
    },
    {
        id: "kleidung-custom",
        label: "Kleidung Custom",
        price: 29.99
    }
];

const sanitizeProductId = (value) =>
    String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

const parsePrice = (value) => {
    const normalized = String(value || "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed * 100) / 100;
};

const getProducts = () => {
    const products = readJsonFile(DATA_FILES.PRODUCTS, DEFAULT_PRODUCTS);
    return Array.isArray(products) ? products : DEFAULT_PRODUCTS;
};

const saveProducts = (products) => writeJsonFile(DATA_FILES.PRODUCTS, products);

const findProductById = (id) => getProducts().find((product) => product.id === sanitizeProductId(id)) || null;

const upsertProduct = ({ id, label, price }) => {
    const normalizedId = sanitizeProductId(id);
    const normalizedPrice = parsePrice(price);

    if (!normalizedId) throw new Error("Ungültige Produkt-ID.");
    if (!label || !String(label).trim()) throw new Error("Produktname darf nicht leer sein.");
    if (normalizedPrice === null) throw new Error("Preis ist ungültig.");

    const products = getProducts();
    const next = {
        id: normalizedId,
        label: String(label).trim().slice(0, 100),
        price: normalizedPrice
    };
    const existingIndex = products.findIndex((product) => product.id === normalizedId);
    if (existingIndex === -1) {
        products.push(next);
    } else {
        products[existingIndex] = next;
    }
    saveProducts(products);
    return next;
};

const removeProduct = (id) => {
    const normalizedId = sanitizeProductId(id);
    const products = getProducts();
    const nextProducts = products.filter((product) => product.id !== normalizedId);
    if (nextProducts.length === products.length) return false;
    saveProducts(nextProducts);
    return true;
};

const updateProductField = (id, updates) => {
    const normalizedId = sanitizeProductId(id);
    const products = getProducts();
    const index = products.findIndex((product) => product.id === normalizedId);
    if (index === -1) return null;

    const current = products[index];
    const next = { ...current };

    if (Object.prototype.hasOwnProperty.call(updates, "label")) {
        if (!updates.label || !String(updates.label).trim()) {
            throw new Error("Produktname darf nicht leer sein.");
        }
        next.label = String(updates.label).trim().slice(0, 100);
    }

    if (Object.prototype.hasOwnProperty.call(updates, "price")) {
        const normalizedPrice = parsePrice(updates.price);
        if (normalizedPrice === null) throw new Error("Preis ist ungültig.");
        next.price = normalizedPrice;
    }

    products[index] = next;
    saveProducts(products);
    return next;
};

module.exports = {
    getProducts,
    findProductById,
    upsertProduct,
    removeProduct,
    updateProductField,
    sanitizeProductId,
    parsePrice
};
