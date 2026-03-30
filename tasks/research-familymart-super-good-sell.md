# Research Report: FamilyMart Taiwan "全家超級好賣" Platform & Frozen Shipping Integration

**Date:** 2026-03-23
**Confidence Level:** High (85%) for platform features, Medium (70%) for API/integration specifics
**Research Method:** Multi-source web research, cross-referenced across official docs, tutorials, developer documentation, and user experience articles

---

## Executive Summary

FamilyMart's "全家超級好賣" is a closed-ecosystem e-commerce platform with **no public API** and **limited data export capabilities**. Sellers see buyer name and phone (for fulfillment) but likely not email. Customer data is owned by FamilyMart. However, a **viable hybrid workflow exists**: using **PayNow (立吉富)** as a third-party logistics API provider, a self-built website can programmatically create FamilyMart frozen C2C shipments. The catch: the PayNow rate is **NT$190/shipment** (not the NT$99 promotional rate, which is only available through FamiPort personal shipping or the 超級好賣 platform).

---

## 1. Platform Capabilities

### 1.1 Does 全家超級好賣 have an API?

**No.** There is no public API, no developer documentation, and no webhook/integration endpoints. The platform is a completely closed system accessible only through:

- The 好賣+ mobile app (iOS/Android)
- The web dashboard at famistore.famiport.com.tw

No third-party integrations are documented beyond:

- LINE/Google login for buyers
- 藍新金流 (Newebpay) for optional credit card processing
- Built-in "聊聊" messaging for buyer-seller communication

### 1.2 Can you export order data?

**Extremely limited.** Research found:

- **No CSV/Excel export** functionality mentioned anywhere
- A basic "帳務查詢" (financial inquiry/reconciliation) feature exists for payment tracking
- No bulk data download capability identified
- The 好店+ (premium tier, requires business registration) offers "營銷報表分析" (marketing/sales report analysis), but even this tier has no documented export feature

### 1.3 What customer data does the seller see?

Based on research, when an order comes in, the seller sees:

- **Buyer name** (收件人姓名) - YES
- **Buyer phone number** (手機) - YES (needed for fulfillment; last 3 digits used at FamiPort)
- **Pickup store location** (取貨門市) - YES
- **Order amount** - YES
- **Payment method** - YES
- **Shipping status** - YES
- **Email address** - UNCLEAR (buyers enter email at registration, but unclear if sellers see it)
- **Physical address** - NO (store-to-store means no home address)

Key finding: There is an option for sellers to check "不用揭露聯繫資料" (don't disclose contact info), which implies that by default, some contact data IS visible to buyers about the seller, and possibly vice versa.

### 1.4 Data the platform collects from buyers (per privacy policy)

The privacy policy at famistore.famiport.com.tw/privacy-policy reveals the platform collects:

- 姓名 (name)
- 行動電話號碼 (mobile phone)
- 使用者帳號 (user account)
- 電子郵件地址 (email)
- 信用卡資訊 (credit card info)
- 銀行帳戶資訊 (bank account info)
- 身分證字號 (national ID number)
- 出生年月日 (date of birth)
- 性別 (gender)
- 聯絡方式 (contact methods)
- LINE帳號 (LINE account)
- 寄送地址 (shipping address)
- IP位址 (IP address)

**However, this does NOT mean sellers see all of this.** The data is collected by FamilyMart; sellers likely only see what's necessary for order fulfillment.

---

## 2. Hybrid Workflow Possibility

### 2.1 Can a seller take orders on their OWN website, then use FamilyMart's 99 NTD frozen shipping?

**YES, but manually.** Here's the workflow:

1. Customer orders on your website
2. Customer tells you their preferred FamilyMart pickup store
3. Seller opens the **全家便利商店 APP** or **FamiPort website** (fmec.famiport.com.tw)
4. Seller creates a personal C2C frozen shipment:
   - Enter sender name + phone
   - Enter receiver name + phone
   - Select frozen option + box size (S60/S90/S105)
   - Select destination store
5. Get the shipping code
6. Go to a FamilyMart, print label at FamiPort machine
7. Pre-chill items to -18°C for 12+ hours, pack in approved box
8. Hand to store clerk

**Cost: NT$99** (current promotional rate for all box sizes, island-to-island)

**Drawbacks:**

- Completely manual process (no automation possible)
- Requires FamilyMart member account
- Must individually create each shipment via the app/website
- No bulk/batch creation
- No tracking integration with your own website
- FamiPort label must be printed within 12 hours of creation
- Package must be shipped within 24 hours of label printing

### 2.2 Can FamiPort C2C be used without the 超級好賣 platform?

**YES.** FamiPort C2C personal shipping (個人寄件) is a standalone service available to ANY FamilyMart member. It is completely independent of the 超級好賣 selling platform. You just need:

- A 全家會員 (FamilyMart member) account
- The FamilyMart APP or FamiPort website
- Receiver's name, phone number, and preferred pickup store

This is the service that offers the **NT$99 frozen shipping rate**.

### 2.3 Can you programmatically link an external system with FamilyMart shipping?

**YES, through third-party logistics aggregators:**

#### Option A: PayNow (立吉富)

- **Supports:** 全家冷凍 C2C store-to-store
- **API available:** Yes, with full documentation
- **Individual sellers OK:** Yes ("無申請條件限制，個人賣家／營登店家皆可申請")
- **Cost:** **NT$190/shipment** (NOT NT$99 -- this is the key difference)
- **Setup:** Free registration, no contract, no setup fee
- **Integration:** API credentials provided after registration
- **Features:** E-map for store selection, shipment creation/query/cancel, status callbacks

#### Option B: ECPay (綠界科技)

- **Supports:** 全家 C2C store-to-store (regular temperature ONLY)
- **FamilyMart frozen C2C:** **NOT SUPPORTED** through ECPay
- **Frozen options via ECPay:** Only 7-ELEVEN B2C bulk consignment + Black Cat cold delivery
- **Cost:** Varies; requires merchant account

#### Option C: SmilePay (速買配)

- **Supports:** 全家 C2C store-to-store (regular temperature ONLY)
- **Frozen:** **Explicitly prohibited**
- **Cost:** NT$60/shipment for regular

**Summary of programmatic frozen FamilyMart options:**

| Provider          | 全家冷凍 C2C | Rate   | API | Individual OK |
| ----------------- | ------------ | ------ | --- | ------------- |
| PayNow            | YES          | NT$190 | YES | YES           |
| ECPay             | NO           | N/A    | N/A | YES           |
| SmilePay          | NO           | N/A    | N/A | YES           |
| FamiPort (manual) | YES          | NT$99  | NO  | YES           |
| 超級好賣 platform | YES          | NT$99  | NO  | YES           |

---

## 3. 全家超級好賣 Seller Experience

### 3.1 Seller Dashboard

The dashboard includes these sections:

- **銷售總覽** (Sales Summary) - overview page
- **賣場與商品管理** (Store & Product Management) - catalog control
- **訂單管理** (Order Management) - split into seller/buyer order views
- **金物流設定** (Payment/Logistics Settings) - shipping configuration
- **帳務查詢** (Financial Inquiry) - payment reconciliation
- **個人設定** (Personal Settings) - account/banking details

### 3.2 Inventory & Order History

- Sellers can manage product listings (up to 7 photos per item, 2MB each)
- Order history is viewable through the seller order management section
- Orders can be searched/filtered
- Sellers can track shipment status in real-time

### 3.3 Notifications

- "銷售通知" (Sales Notifications) can be enabled in store settings
- Specific channels (email, SMS, push) are not clearly documented
- The "聊聊" messaging feature provides real-time buyer-seller communication

### 3.4 Data Export

- **No CSV/Excel export identified**
- Financial reconciliation statements (對帳單) are viewable with:
  - 預計撥款時間 (expected payment date)
  - 匯款批號 (transfer batch number)
  - 對帳金額 (reconciliation amount)
  - 狀態 (status)
  - 匯款帳號 (transfer account)

### 3.5 Additional Features (超級好賣 vs 好賣+)

超級好賣 adds over basic 好賣+:

- Frozen shipping (冷凍店到店) at NT$99
- Group buying (團購) with configurable close dates and quantity discounts
- SEO optimization for storefront
- Promotional countdown timers
- Home delivery (宅配) support
- Member tiering with label-based classification
- Blacklist functionality for problematic buyers

---

## 4. FamiPort C2C Frozen Shipping Workflow (Manual/Personal)

### Step-by-step process:

1. **Open the 全家便利商店 APP** (or FamiPort website at fmec.famiport.com.tw)
   - Note: FamiPort physical machines do NOT support frozen shipping creation

2. **Log in** with your 全家會員 account

3. **Select "寄件店到店"** (store-to-store shipping)

4. **Fill in sender info:**
   - Sender name (寄件人姓名)
   - Sender phone (寄件人電話)

5. **Select "冷凍" (frozen) option**

6. **Choose box size:**
   - S60: 28x20x12cm, max 5kg
   - S90: 38x28x24cm, max 10kg
   - S105: 45x30x30cm, max 10kg

7. **Fill in receiver info:**
   - Receiver name (收件人姓名)
   - Receiver phone (收件人電話)

8. **Select destination store** (receiver's preferred FamilyMart)

9. **Optionally set return store** (退貨店鋪 -- where unclaimed items go; defaults to sending store)

10. **Confirm and pay** - generates a QR code for payment at FamilyMart counter

11. **Go to any FamilyMart within 12 hours** and print the shipping label at the FamiPort machine

12. **Package requirements:**
    - Items must be pre-frozen at -18°C or below for 12+ hours
    - Must use rigid cardboard boxes (as of June 2025, FamilyMart's own branded boxes are no longer mandatory)
    - No styrofoam or insulated bags

13. **Hand package to store clerk** within 24 hours of printing label

### Key details:

- **Cost:** NT$99 (promotional, all box sizes, domestic)
- **COD option:** NT$114 (取貨付款)
- **Delivery time:** 2-4 days
- **Unclaimed packages:** Returned after 5 days; seller pays NT$35 return fee
- **Prohibited items:** Ice cream, popsicles, cakes, breast milk, dumplings, wontons, glutinous rice balls, anything requiring special temperature storage, items with <1 month shelf life

### Does seller need receiver's store preference in advance?

**YES.** You must specify the exact destination FamilyMart store when creating the shipment. The receiver cannot change it after creation.

### Can seller just get a shipping code and hand it to the buyer?

**Not quite.** The seller creates the full shipment (including destination store), gets a shipping code, prints a label, packages and drops off. The buyer just goes to pick up. There's no "generic" shipping code that the buyer can use at any store.

---

## 5. Data Ownership Concerns

### 5.1 Who owns the customer data?

**FamilyMart (全家便利商店) owns all customer data.** Per the privacy policy:

- Data is collected by the platform operator
- Shared with specific partner companies: 日翊公司, 全台公司, 優選公司, 畢思博客整合行銷有限公司
- Sellers only receive data necessary for "transaction completion or termination"

### 5.2 Can sellers contact customers directly outside the platform?

**Technically possible but restricted.**

- Sellers see buyer name and phone number (needed for shipping)
- The platform provides "聊聊" as the intended communication channel
- The privacy policy states data cannot be used "於特定目的以外之使用" (beyond specified purposes)
- There is no explicit technical block preventing a seller from noting down a phone number, but doing so for marketing purposes would violate the platform's terms

### 5.3 Are customer phone numbers/emails visible to sellers?

- **Phone numbers:** YES (visible in order details, needed for FamiPort pickup verification)
- **Email addresses:** UNCERTAIN (collected at registration but unclear if exposed to sellers)
- **Physical address:** NO (store-to-store model eliminates this)
- **National ID / Bank details:** NO (these are platform-level data only)

---

## 6. Conclusions & Recommendations

### The Core Question: Can you bridge a self-built website with FamilyMart's NT$99 frozen shipping?

**Answer: Yes, but only through a manual workflow.** There is no API that provides the NT$99 rate.

### Three realistic options:

#### Option 1: Manual Hybrid (Best Rate)

- Take orders on your own website
- Collect buyer name, phone, and preferred FamilyMart store
- Manually create each frozen C2C shipment via FamilyMart APP
- **Cost: NT$99/shipment**
- **Scalability: Poor** (manual process for every order)
- **Customer data: You own it** (collected on your website)

#### Option 2: PayNow API Integration (Automated)

- Build your website with PayNow logistics API
- Programmatically create FamilyMart frozen C2C shipments
- **Cost: NT$190/shipment** (nearly double)
- **Scalability: Excellent** (fully automated)
- **Customer data: You own it** (collected on your website, PayNow is just logistics)

#### Option 3: 全家超級好賣 Platform (Cheapest but locked in)

- Use FamilyMart's platform as your storefront
- **Cost: NT$99/shipment frozen, NT$35/shipment regular**
- **Scalability: Good** (platform handles everything)
- **Customer data: FamilyMart owns it** (limited visibility, no export)

### Recommendation for a chatbot-based frozen food business:

The **Manual Hybrid (Option 1)** is likely optimal for early stage:

- Your chatbot takes orders via LINE
- You collect customer name, phone, and preferred FamilyMart store
- You manually create frozen shipments via the FamilyMart APP (99 NTD each)
- You own ALL customer data
- When volume grows beyond manageable manual processing (perhaps 20+ orders/day), upgrade to PayNow API at NT$190/shipment

The price difference (NT$99 vs NT$190) is significant per shipment. At 100 orders/month, that's NT$9,100/month extra for automation. The break-even depends on the labor cost of manual shipment creation.

---

## Sources

- [全家超級好賣 寄件完整教學 - CP值](https://cpok.tw/29000)
- [全家好賣+ 使用教學 - free.com.tw](https://free.com.tw/famistore/)
- [全家推「超級好賣」平台 - 數位時代](https://www.bnext.com.tw/article/70839/familymart-famishop-2022)
- [全家開店平台比一比 - INSIDE](https://www.inside.com.tw/feature/familymart-ec/20243-familymart-ec-compare)
- [全家冷凍店到店 99元 寄件教學 - CP值](https://cpok.tw/37497)
- [FamilyMart 寄件店到店 官方](https://fmec.famiport.com.tw/FP_Entrance/Notice)
- [全家好賣+ 隱私權條款](https://famistore.famiport.com.tw/privacy-policy)
- [PayNow 物流串接 - ShopStore](https://shopstore.tw/teachinfo/543)
- [PayNow API 技術文件](https://owlting.github.io/paynow-guideline/docs/api-reference/)
- [PayNow Getting Started](https://docs.paynow.com.tw/docs/getting-started/)
- [CYBERBIZ 全家冷凍店到店](https://www.cyberbiz.io/support/?p=40721)
- [ECPay 物流類型確認](https://support.ecpay.com.tw/21685/)
- [ECPay C2C 全家 Developer Docs](https://developers.ecpay.com.tw/?p=8848)
- [ECPay 全方位物流服務](https://www.ecpay.com.tw/IntroTransport)
- [SmilePay 全家C2C](https://www.smilepay.net/es/cargo_C2C_familymart.asp)
- [超商線上商店比較 - CP值](https://cpok.tw/29087)
- [全家好賣+ 寄件教學 - CP值](https://cpok.tw/27241)
- [全家好賣+ 寄件懶人包 - kkplay3c](https://kkplay3c.net/famistore/)
