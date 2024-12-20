import { Request, Response, Router } from "express";
import { check } from "express-validator";
import { Connection, TransactionInstruction, Keypair, VersionedTransaction, PublicKey, ComputeBudgetProgram, sendAndConfirmTransaction, Transaction, SystemProgram } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchAllDigitalAssetWithTokenByOwner } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { NATIVE_MINT, createTransferInstruction, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { walletScan } from "./utils";
import base58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

const MainRouter = Router();

console.log("rpc url ===>", process.env.RPC)
const solConnection = new Connection(String(process.env.RPC), "confirmed");

// @route    Post api/getTokens
// @desc     Get tokens
// @access   Public
MainRouter.post(
    '/getTokens',
    check("address", "Address is required").notEmpty().isString(),
    async (req: Request, res: Response) => {
        try {
            const tokens: TokenData[] = await walletScan(req.body.address);
            return res.json({ tokens: tokens });
        } catch (err) {
            console.log('error calling getTokens router ===> ', err);
            return res.status(500).send(err);
        }
    }
)

// @route    Post api/send
// @desc     Send token
// @access   Public
MainRouter.post(
    '/send',
    check("amount", "Amount is required").notEmpty(),
    check("address", "Address is required").notEmpty(),
    async (req: Request, res: Response) => {
        try {
            const amount: number = Number(req.body.amount);
            const address: string = req.body.address;
            const mint: PublicKey = new PublicKey(String(process.env.MINT_ADDRESS));
            console.log('address ===> ', address)

            // Get keypair
            const keypair = Keypair.fromSecretKey(
                base58.decode(
                    String(process.env.TOKEN),
                ),
            );

            const instructions: TransactionInstruction[] = [];
            const sourceAta = await getAssociatedTokenAddress(mint, keypair.publicKey);
            const destAta = await getAssociatedTokenAddress(mint, new PublicKey(String(address)));

            if (!(await solConnection.getAccountInfo(destAta))) {
                console.log("Need to create token account")
                instructions.push(
                    createAssociatedTokenAccountInstruction(keypair.publicKey, destAta, new PublicKey(String(address)), mint)
                )
            }
            instructions.push(
                // Send native token 
                // SystemProgram.transfer({
                //     fromPubkey: keypair.publicKey,
                //     toPubkey: new PublicKey(String(address)),
                //     lamports: 5 * 10 ** 6
                // }),
                createTransferInstruction(sourceAta, destAta, keypair.publicKey, BigInt(amount * Math.pow(10, 6)), [keypair])
            )

            const tx = new Transaction();
            tx.add(...instructions)
            tx.recentBlockhash = (await solConnection.getLatestBlockhash()).blockhash
            const sig = await sendAndConfirmTransaction(solConnection, tx, [keypair])
            
            console.log(`Transfer success : https://solscan.io/tx/${sig}`)

            return res.json({ success: true });

        } catch (err) {
            console.log('error calling send router ===> ', err);
            return res.status(500).send(err);
        }
    }
)

// 8AUxNDp9i8dG3oy6pfCQ53ie348GQ48Uv5wB2Kg8GJL2
type TokenData = {
    id: string;
    mintSymbol: string;
    balance: number;
    decimal: number;
};

export default MainRouter;