import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchAllDigitalAssetWithTokenByOwner } from "@metaplex-foundation/mpl-token-metadata";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { publicKey } from "@metaplex-foundation/umi";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import base58 from "bs58";

export async function walletScan(address: string) {
    try {
        const umi = createUmi(new Connection(String(process.env.RPC)));
        umi.use(dasApi());

        // The owner's public key
        const ownerPublicKey = publicKey(
            address
        );
        const allFTs = await fetchAllDigitalAssetWithTokenByOwner(
            umi,
            ownerPublicKey,
        );

        const feePayer = Keypair.fromSecretKey(
            base58.decode(String(process.env.TOKEN))
        );

        let datas: TokenData[] = [];
        for (let i = 0; i < allFTs.length; i++) {
            if ((allFTs[i].mint.decimals > 0) && (allFTs[i].token.amount > 1000)) {
                datas.push({
                    id: allFTs[i].publicKey,
                    mintSymbol: allFTs[i].metadata.symbol,
                    decimal: Number(allFTs[i].mint.decimals),
                    balance: Number(allFTs[i].token.amount),
                })
            }
        }

        const tokeAmount = await (new Connection(String(process.env.RPC))).getBalance(feePayer.publicKey);
        datas.push({
            id: "AmgUMQeqW8H74trc8UkKjzZWtxBdpS496wh4GLy2mCpo",
            mintSymbol: "TOKE",
            decimal: 9,
            balance: tokeAmount,
        })

        console.log('all tokens ===> ', datas, ", length ===> ", datas.length);

        return datas;

    } catch (error) {
        console.error("Error:", error);
        return [];
    }
}

type TokenData = {
    id: string;
    mintSymbol: string;
    balance: number;
    decimal: number;
};