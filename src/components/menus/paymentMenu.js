import React from 'react';

const PaymentMenu = () => {
    return (
        <select>
            <option value="credit-card">Credit Card</option>
            <option value="paypal">PayPal</option>
            <option value="bank-transfer">Bank Transfer</option>
        </select>
    );
};

export default PaymentMenu;