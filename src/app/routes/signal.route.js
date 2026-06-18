const { Router } = require("express");
const catchAsync = require("../../utils/catchAsync");
const { httpResponse } = require("../../utils/httpResponse");
const signalStore = require("../../engine/signalStore");

const router = Router();

router.get(
  "/active",
  catchAsync(async (req, res) => {
    const signals = await signalStore.getActiveSignals();
    return res.status(200).json(httpResponse("success", signals, "Active signals"));
  })
);

router.get(
  "/all",
  catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const signals = await signalStore.getAllSignals(limit);
    return res.status(200).json(httpResponse("success", signals, "All signals"));
  })
);

router.get(
  "/stats",
  catchAsync(async (req, res) => {
    const stats = await signalStore.getSignalStats();
    return res.status(200).json(httpResponse("success", stats, "Signal statistics"));
  })
);

router.get(
  "/archive",
  catchAsync(async (req, res) => {
    const archived = await signalStore.archiveCompleted();
    return res.status(200).json(httpResponse("success", archived, "Archived signals"));
  })
);

router.post(
  "/create",
  catchAsync(async (req, res) => {
    const signal = await signalStore.createSignal(req.body);
    return res.status(201).json(httpResponse("success", signal, "Signal created"));
  })
);

router.put(
  "/:id/status",
  catchAsync(async (req, res) => {
    const { status, exitPrice } = req.body;
    const signal = await signalStore.updateSignalStatus(req.params.id, status, exitPrice);
    if (!signal) return res.status(404).json(httpResponse("error", null, "Signal not found"));
    return res.status(200).json(httpResponse("success", signal, "Signal updated"));
  })
);

router.delete(
  "/clear",
  catchAsync(async (req, res) => {
    await signalStore.clearAll();
    return res.status(200).json(httpResponse("success", null, "All signals cleared"));
  })
);

module.exports = router;
