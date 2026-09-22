// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Native BOT escrow marketplace. Execution and delivery happen off-chain.
contract BitMarket {
    uint256 public constant REFUND_DELAY = 7 days;
    struct Service { address provider; string metadata; uint256 price; bool active; uint256 ratingTotal; uint256 ratingCount; }
    enum Status { Paid, Delivered, Completed, Refunded }
    struct Job { uint256 serviceId; address buyer; address provider; uint256 amount; uint256 createdAt; Status status; string brief; string result; }
    Service[] public services;
    Job[] public jobs;
    mapping(address => uint256) public credits;
    bool private locked;
    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, uint256 price, string metadata);
    event ServiceUpdated(uint256 indexed serviceId, uint256 price, bool active);
    event ServiceRequested(uint256 indexed jobId, uint256 indexed serviceId, address indexed buyer, uint256 amount);
    event ServiceDelivered(uint256 indexed jobId, string result);
    event ServiceCompleted(uint256 indexed jobId, address indexed provider, uint256 amount, uint8 rating);
    event ServiceRefunded(uint256 indexed jobId, address indexed buyer, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);
    event Interaction(address indexed account);
    modifier nonReentrant() { require(!locked, "Reentrant call"); locked = true; _; locked = false; }
    function serviceCount() external view returns (uint256) { return services.length; }
    function jobCount() external view returns (uint256) { return jobs.length; }
    /// @notice Records a minimal, successful contract interaction without changing marketplace state.
    function interact() external { emit Interaction(msg.sender); }
    function registerService(string calldata metadata, uint256 price) external returns (uint256 id) {
        require(bytes(metadata).length > 0 && bytes(metadata).length <= 4096, "Invalid metadata");
        require(price > 0, "Invalid price");
        id = services.length;
        services.push(Service(msg.sender, metadata, price, true, 0, 0));
        emit ServiceRegistered(id, msg.sender, price, metadata);
    }
    function updateService(uint256 id, uint256 price, bool active) external {
        Service storage service = services[id];
        require(msg.sender == service.provider, "Provider only"); require(price > 0, "Invalid price");
        service.price = price; service.active = active;
        emit ServiceUpdated(id, price, active);
    }
    function requestService(uint256 id, string calldata brief) external payable returns (uint256 jobId) {
        Service storage service = services[id];
        require(service.active, "Service inactive"); require(msg.value == service.price, "Incorrect payment");
        require(msg.sender != service.provider, "Cannot hire yourself");
        require(bytes(brief).length > 0 && bytes(brief).length <= 4096, "Invalid brief");
        jobId = jobs.length;
        jobs.push(Job(id, msg.sender, service.provider, msg.value, block.timestamp, Status.Paid, brief, ""));
        emit ServiceRequested(jobId, id, msg.sender, msg.value);
    }
    function deliverService(uint256 id, string calldata result) external {
        Job storage job = jobs[id]; require(msg.sender == job.provider, "Provider only");
        require(job.status == Status.Paid, "Invalid status");
        require(bytes(result).length > 0 && bytes(result).length <= 4096, "Invalid result");
        job.status = Status.Delivered; job.result = result; emit ServiceDelivered(id, result);
    }
    function completeService(uint256 id, uint8 rating) external {
        Job storage job = jobs[id]; require(msg.sender == job.buyer, "Buyer only");
        require(job.status == Status.Delivered, "Not delivered"); require(rating >= 1 && rating <= 5, "Invalid rating");
        job.status = Status.Completed; credits[job.provider] += job.amount;
        Service storage service = services[job.serviceId]; service.ratingTotal += rating; service.ratingCount++;
        emit ServiceCompleted(id, job.provider, job.amount, rating);
    }
    function refundService(uint256 id) external {
        Job storage job = jobs[id]; require(msg.sender == job.buyer, "Buyer only");
        require(job.status == Status.Paid, "Invalid status");
        require(block.timestamp >= job.createdAt + REFUND_DELAY, "Too early");
        job.status = Status.Refunded; credits[job.buyer] += job.amount;
        emit ServiceRefunded(id, job.buyer, job.amount);
    }
    function withdraw() external nonReentrant {
        uint256 amount = credits[msg.sender]; require(amount > 0, "No credit");
        credits[msg.sender] = 0; (bool ok,) = msg.sender.call{value: amount}(""); require(ok, "Transfer failed");
        emit Withdrawal(msg.sender, amount);
    }
}
