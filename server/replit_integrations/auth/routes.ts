import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./sessionAuth";
import { loginSchema, registerSchema } from "@shared/models/auth";
import { z } from "zod";

const LEGAL_VERSION = process.env.LEGAL_VERSION || "2026-01-01";

const acceptLegalSchema = z.object({
  acceptTerms: z.boolean().refine(v => v === true, "You must accept the terms"),
  acceptPrivacy: z.boolean().refine(v => v === true, "You must accept the privacy policy"),
  acceptDisclaimer: z.boolean().refine(v => v === true, "You must accept the disclaimer"),
});

export function registerAuthRoutes(app: Express): void {
  app.get("/api/legal/version", (req, res) => {
    res.json({ version: LEGAL_VERSION });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existingUser = await authStorage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await authStorage.createUser(
        data.email,
        data.password,
        data.firstName,
        data.lastName
      );

      if (req.body.acceptLegal) {
        await authStorage.updateUser(user.id, {
          acceptedLegalVersion: LEGAL_VERSION,
          acceptedAt: new Date(),
          acceptedIp: req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
          acceptedUserAgent: req.headers["user-agent"] || "unknown",
        });
      }

      req.session.userId = user.id;
      
      const updatedUser = await authStorage.getUser(user.id);
      const { password: _, ...safeUser } = updatedUser!;
      res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await authStorage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValid = await authStorage.validatePassword(data.password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.id;
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = await authStorage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/accept-legal", isAuthenticated, async (req, res) => {
    try {
      acceptLegalSchema.parse(req.body);
      
      const user = await authStorage.updateUser(req.session.userId!, {
        acceptedLegalVersion: LEGAL_VERSION,
        acceptedAt: new Date(),
        acceptedIp: req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
        acceptedUserAgent: req.headers["user-agent"] || "unknown",
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Accept legal error:", error);
      res.status(500).json({ message: "Failed to accept legal terms" });
    }
  });

  app.get("/api/auth/legal-status", isAuthenticated, async (req, res) => {
    try {
      const user = await authStorage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isAccepted = user.acceptedLegalVersion === LEGAL_VERSION;
      res.json({
        accepted: isAccepted,
        currentVersion: LEGAL_VERSION,
        acceptedVersion: user.acceptedLegalVersion,
        acceptedAt: user.acceptedAt,
      });
    } catch (error) {
      console.error("Legal status error:", error);
      res.status(500).json({ message: "Failed to get legal status" });
    }
  });
}
