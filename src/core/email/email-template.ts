type EmailTemplateInput = {
    preheader: string;
    heading: string;
    body: string;
    actionLabel?: string;
    actionUrl?: string;
    details?: Array<{
      label: string;
      value: string;
    }>;
  };
  
  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  export function createSenzilyticsEmailTemplate(
    input: EmailTemplateInput
  ) {
    const safeHeading = escapeHtml(input.heading);
    const safeBody = escapeHtml(input.body).replaceAll(
      "\n",
      "<br />"
    );
  
    const detailsHtml =
      input.details && input.details.length > 0
        ? `
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="
              margin-top: 24px;
              border-collapse: collapse;
              border: 1px solid #dbe4ee;
              border-radius: 12px;
              overflow: hidden;
            "
          >
            ${input.details
              .map(
                (detail) => `
                  <tr>
                    <td
                      style="
                        width: 38%;
                        padding: 12px 16px;
                        background: #f8fafc;
                        border-bottom: 1px solid #e2e8f0;
                        color: #475569;
                        font-size: 13px;
                        font-weight: 600;
                      "
                    >
                      ${escapeHtml(detail.label)}
                    </td>
  
                    <td
                      style="
                        padding: 12px 16px;
                        border-bottom: 1px solid #e2e8f0;
                        color: #0f172a;
                        font-size: 13px;
                      "
                    >
                      ${escapeHtml(detail.value)}
                    </td>
                  </tr>
                `
              )
              .join("")}
          </table>
        `
        : "";
  
    const actionHtml =
      input.actionLabel && input.actionUrl
        ? `
          <div style="margin-top: 28px;">
            <a
              href="${escapeHtml(input.actionUrl)}"
              style="
                display: inline-block;
                padding: 13px 22px;
                border-radius: 10px;
                background: #22d3ee;
                color: #082f49;
                font-size: 14px;
                font-weight: 700;
                text-decoration: none;
              "
            >
              ${escapeHtml(input.actionLabel)}
            </a>
          </div>
        `
        : "";
  
    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>${safeHeading}</title>
        </head>
  
        <body
          style="
            margin: 0;
            padding: 0;
            background: #f1f5f9;
            font-family: Arial, Helvetica, sans-serif;
          "
        >
          <div
            style="
              display: none;
              max-height: 0;
              overflow: hidden;
              opacity: 0;
            "
          >
            ${escapeHtml(input.preheader)}
          </div>
  
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="background: #f1f5f9;"
          >
            <tr>
              <td align="center" style="padding: 32px 16px;">
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  style="
                    max-width: 640px;
                    background: #ffffff;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
                  "
                >
                  <tr>
                    <td
                      style="
                        padding: 24px 32px;
                        background: #020617;
                      "
                    >
                      <div
                        style="
                          color: #22d3ee;
                          font-size: 22px;
                          font-weight: 800;
                          letter-spacing: 0.3px;
                        "
                      >
                        SENZILYTICS
                      </div>
  
                      <div
                        style="
                          margin-top: 4px;
                          color: #94a3b8;
                          font-size: 12px;
                        "
                      >
                        Enterprise EHS and Compliance Platform
                      </div>
                    </td>
                  </tr>
  
                  <tr>
                    <td style="padding: 32px;">
                      <h1
                        style="
                          margin: 0;
                          color: #0f172a;
                          font-size: 26px;
                          line-height: 1.3;
                        "
                      >
                        ${safeHeading}
                      </h1>
  
                      <p
                        style="
                          margin: 18px 0 0;
                          color: #475569;
                          font-size: 15px;
                          line-height: 1.7;
                        "
                      >
                        ${safeBody}
                      </p>
  
                      ${detailsHtml}
                      ${actionHtml}
                    </td>
                  </tr>
  
                  <tr>
                    <td
                      style="
                        padding: 20px 32px;
                        background: #f8fafc;
                        color: #64748b;
                        font-size: 12px;
                        line-height: 1.6;
                      "
                    >
                      This is an automated notification from
                      Senzilytics. Please do not share sensitive
                      incident or compliance information outside
                      your organization.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }