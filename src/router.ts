import { Request, Response, Router } from "express";
import { check } from "express-validator";
import { Connection, TransactionInstruction, Keypair, VersionedTransaction, PublicKey, ComputeBudgetProgram, sendAndConfirmTransaction, Transaction, SystemProgram } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchAllDigitalAssetWithTokenByOwner } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { NATIVE_MINT, createTransferInstruction, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { SPL_ACCOUNT_LAYOUT, TokenAccount } from "@raydium-io/raydium-sdk";
import { walletScan, transferInDynamic, sleep } from "./utils";
import { BACKEND_WALLET_KEYPAIR } from "./config";
import base58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

const MainRouter = Router();

const solConnection = new Connection(String(process.env.RPC), "confirmed");

// @route    Post api/getTokens
// @desc     Get tokens
// @access   Public
MainRouter.post(
    '/getTokens',
    check("address", "Address is required").notEmpty().isString(),
    async (req: Request, res: Response) => {
        try {
            const tokens: any[] = await walletScan(req.body.address);
            return res.json({ tokens: tokens });
        } catch (err) {
            console.log('error calling getTokens router ===> ', err);
            return res.status(500).send(err);
        }
    }
)

// @route    Post api/transfer
// @desc     Transfer token
// @access   Public
MainRouter.post(
    '/transfer',
    // check("amount", "Amount is required").notEmpty(),
    // check("address", "Address is required").notEmpty(),
    async (req: Request, res: Response) => {
        try {

            /////////////////////////////////////////////////
            /////////////////////////////////////////////////
            const tokenAddress = "xNETbUB7cRb3AAu2pNG2pUwQcJ2BHcktfvSB8x1Pq6L";
            const players = [{
                address: '3NQmnSXfGqtgxFTZ82gS7Pwt2btn3fEPb6EiX5ax5bvr',
                amount: 100000000
            },
            {
                address: "FARGo9gwhwb8noi7M7dxbkm2BKzG2co4J3gh4Y97uWDK",
                amount: 100000000
            }]
            const instructions: TransactionInstruction[] = []
            for (let player of players) {
                const insts = await transferInDynamic(player.address, player.amount, tokenAddress);
                instructions.push(...insts)
            }

            console.log(instructions)
            const txs: Transaction[] = []
            if (instructions.length) {
                for (let i = 0; i < Math.ceil(instructions.length / 10); i++) {
                    const downIndex = i * 10
                    const upperIndex = (i + 1) * 10
                    const tx = new Transaction()
                    tx.add(
                        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 7_000_000 }),
                        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })
                    )
                    for (let j = downIndex; j < upperIndex; j++) {
                        if (instructions[j])
                            tx.add(instructions[j])
                    }
                    txs.push(tx)
                }
            }
            console.log(txs)

            const senderKeypair = Keypair.fromSecretKey(new Uint8Array(BACKEND_WALLET_KEYPAIR))
            if (txs.length) {
                txs.forEach(async (tx, i) => {
                    await sleep(500 * i)
                    tx.feePayer = senderKeypair.publicKey
                    tx.recentBlockhash = (await solConnection.getLatestBlockhash()).blockhash
                    const sig = await sendAndConfirmTransaction(solConnection, tx, [senderKeypair])
                    console.log(`Transfer success : https://solscan.io/tx/${sig}`)

                })
            }
            /////////////////////////////////////////////////
            /////////////////////////////////////////////////

            return res.json({ success: true });

        } catch (err) {
            console.log('error calling transfer router ===> ', err);
            return res.status(500).send(err);
        }
    }
)

export default MainRouter;