import { Connection, PublicKey } from "@solana/web3.js";
import { SPL_ACCOUNT_LAYOUT } from "@raydium-io/raydium-sdk";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, createTransferInstruction, createAssociatedTokenAccountIdempotentInstruction, TOKEN_2022_PROGRAM_ID, getTokenMetadata, getMint } from "@solana/spl-token";
import { BACKEND_WALLET } from "./config";
import { error } from "console";

export async function walletScan(address: string) {
    try {

        // The owner's public key
        const ownerPublicKey = new PublicKey(
            address
        );
        const connection = new Connection(String(process.env.RPC));
        const accounts: any[] = [];

        const token2022Accounts = await connection.getTokenAccountsByOwner(
            ownerPublicKey, { programId: TOKEN_2022_PROGRAM_ID }, "confirmed"
        );

        if (token2022Accounts.value.length > 0) {
            for (const { pubkey, account } of token2022Accounts.value) {

                let price = 0;
                const options = { method: 'GET', headers: { 'X-API-KEY': String(process.env.BIRDEYE_KEY) } };
                await fetch(`https://public-api.birdeye.so/defi/price?address=${(SPL_ACCOUNT_LAYOUT.decode(account.data)).mint}`, options)
                    .then(response => response.json())
                    .then(response => {
                        price = Number(response.data.value);
                    })
                    .catch(err => console.error(err));

                const metadata = await getTokenMetadata(connection, new PublicKey(String((SPL_ACCOUNT_LAYOUT.decode(account.data)).mint)), 'confirmed', TOKEN_2022_PROGRAM_ID);
                if (!metadata) {
                    continue;
                }

                const url = await fetch(encodeURI(metadata?.uri));
                if (!url.ok) {
                    continue;
                }
                const data = await url.json();
                
                const mint = await getMint(connection, new PublicKey(String((SPL_ACCOUNT_LAYOUT.decode(account.data)).mint)), 'confirmed', TOKEN_2022_PROGRAM_ID);

                accounts.push({
                    pubkey,
                    mintAddress: (SPL_ACCOUNT_LAYOUT.decode(account.data)).mint,
                    mintSymbol: metadata?.symbol,
                    balance: parseInt((SPL_ACCOUNT_LAYOUT.decode(account.data)).amount, 10),
                    decimal: mint.decimals,
                    uri: data?.image,
                    price: price
                    //   programId: account.owner,
                });
            }
        }

        return accounts;

    } catch (error) {
        console.error("Error:", error);
        return [];
    }
}

export const transferInDynamic = async (
    receiver: string,
    amount: number,
    tokenAddress: string
) => {
    try {
        // const senderKeypair = Keypair.fromSecretKey(new Uint8Array(BACKEND_WALLET_KEYPAIR))
        const source = await getAssociatedTokenAccount(new PublicKey(BACKEND_WALLET), new PublicKey(tokenAddress));
        const destination = await getAssociatedTokenAccount(new PublicKey(receiver), new PublicKey(tokenAddress));
        // const balance = (await solConnection.getTokenAccountBalance(source)).value.amount
        // console.log("balance ", balance)
        // const updateCpIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 7_000_000 })
        // const updateCuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })

        const transferIx = createTransferInstruction(
            source,
            destination,
            new PublicKey(BACKEND_WALLET),
            amount,
            [],
            TOKEN_2022_PROGRAM_ID
        );
        
        const createAtaDestIx = createAssociatedTokenAccountIdempotentInstruction(new PublicKey(BACKEND_WALLET), destination, new PublicKey(receiver), new PublicKey(tokenAddress), TOKEN_2022_PROGRAM_ID)

        return [createAtaDestIx, transferIx]
    } catch (error) {
        console.log("error : ", error)
        return []
    }
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const getAssociatedTokenAccount = async (ownerPubkey: PublicKey, mintPk: PublicKey): Promise<PublicKey> => {
    try {
        let associatedTokenAccountPubkey = (await PublicKey.findProgramAddress(
            [
                ownerPubkey.toBuffer(),
                TOKEN_2022_PROGRAM_ID.toBuffer(),
                mintPk.toBuffer(), // mint address
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        ))[0];
        return associatedTokenAccountPubkey;
    } catch (err) {
        console.log('error in getAssociatedTokenAccount ===> ', error);
        return new PublicKey('');
    }
}