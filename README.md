# Frienance

## Setup

Add [@frienancebot](https://t.me/frienancebot) to the group to get started.

Next, every member that will participate in the operations must run the `/register` command:

```
/register
```

> To run a Frinance command, like any other bot, start typing the command and select the full command suggested by Telegram. I.e., `/regi` and then click `/register@frienancebot`. You can also click the command from the history.

Members that have joint finances, i.e., couples, families, etc., should run `/join` following by the username of the member to join:

```
/join @shepik
```

When you need to separate from a joint finances group, run the `/separate` command:

```
/separate @shepik
```

## Using

### Expenses

When you buy something for everyone in the group to share, i.e., groceries or Airbnb, use the `/expense` command.

Registered expenses will be split evenly between each member of the group.

To add 100 USD (USD is the default currency, [but can be changed](#default-currency)):

```
/expense 100
```

You can also specify currency:

```
/expense 100 CZK
```

And also, add a comment for the future:

```
/expense 100 RUB - Beer
```

### Borrowing/giving

If you give or borrow money from other members, use the `/borrow` or `/give` command followed by the username and amount.

To borrow 100 USD:

```
/borrow @kossnocorp 100
```

To give  100 USD:

```
/give @kossnocorp 100
```

Just like with `/expense` you can add currency and a comment:

```
/borrow 100 CZK
/give 100 RUB - For beer 
```

## Reviwing

To see the current balance (who owes who), run the `/balance` command:

```
/balance
```

To get the entire operations history, run the `/history` command:

```
/history
```

## Resolving

To resolve debt, use `/relief` command following the username of the member whose dept you want to cancel:

```
/relief @the108
```

This will cancel **all** debt owed by the member.

## Default currency

To change the default currency, use the `/currency` command:

```
/currency SGD
```

This will use the specified currency for all future operations but will keep all past operations intact.

## How it works

All registered operations add to an immutable ledger. When non-USD currency is used, the amount will convert to USD using an up-to-date conversion rate (updated once an hour).
