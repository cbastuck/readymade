import Article from "../../components/layout/Article";
import Paragraph from "../../components/layout/Paragraph";

export default function Privacy() {
  return (
    <Article title="Privacy Policy" date="8.3.2024">
      <Paragraph>
        I highly value the privacy of individuals who browse this website,
        especially those who use the playground and additional services at{" "}
        <a href="https://hookup.to">hookup.to</a> or{" "}
        <a href="https://hookitapp.com">hookitapp.com</a> . This privacy policy
        aims to explain how I collect, use, and share information from users of
        my services. While I strive to minimize tracking, it's essential to be
        aware that some data is monitored through server logs when using this
        service. Your use of my services is also subject to the{" "}
        <a href="/terms">Terms and Conditions</a>.
      </Paragraph>
      <Paragraph headline="Information in Server Logs">
        I collect various information from or about you and your devices,
        eventually registration and account details, device information, and
        engagement data. If you choose to engage anonymously, only the provided
        information will be stored, with no connection to server logs containing
        your local IP address.
      </Paragraph>
      <Paragraph headline="Engage">
        If you decide to engage and contribute information, including your name
        and email, this information will be stored in my backend services. If
        you engage anonymously, then I'll only store the information that you
        provided. There is no connection between the engagement data you provide
        and the server logs, which will contain your local IP address, with a
        two-month retention span.
      </Paragraph>
      <Paragraph headline="Information in server logs">
        Device Information. We receive information about the device and software
        you use to access our Services, including IP address, web browser type,
        operating system version, phone carrier and manufacturer, application
        installations, device identifiers. Further the logs contain the dates
        and times of a visits.
      </Paragraph>
      <Paragraph headline="Cookies and Local Storage">
        I do not use third-party partners for information collection through
        cookies, pixel tags, or similar technologies. Any cookies used are
        either session-based, disappearing after closing your browser, or
        persistent, remaining for subsequent visits. Boards that you save are
        stored in the local storage of your browser. If you clear the local
        storage, you will lose all saved boards.
      </Paragraph>
      <Paragraph headline="How I Use the Collected Information">
        If you provide an email address, it will be used for communication,
        updates, and responding to queries. Server logs help me maintain,
        improve, and analyze services, prevent fraud, and address safety issues,
        but there is no connection between the server logs and provided email
        addresses. Periodically, I may ask questions in the engage section to
        understand user preferences and needs. The purpose is to understand my
        target audience and analyze how you wish to use the services, features,
        and functionality. Server logs are also necessary to find and prevent
        fraud and respond to trust and safety issues that may arise; for
        compliance purposes, including enforcing my legal rights, or as may be
        required by applicable laws and regulations or requested by any judicial
        process or governmental agency.
      </Paragraph>
      <Paragraph headline="How I Disclose the Collected Information">
        I may disclose information as required by law, responding to legal
        requests, or safeguarding rights, property, or safety. Your information
        may be disclosed with your permission or if objectionable content is
        posted.
      </Paragraph>
      <Paragraph headline="Marketing">
        You can unsubscribe from promotional emails, but administrative messages
        will still be sent. We do not respond to Do Not Track signals.
      </Paragraph>
      <Paragraph headline="Third Parties">
        Links to external websites are included, and this Privacy Policy does
        not cover third-party privacy practices. Please review their policies
        before providing any information.
      </Paragraph>
      <Paragraph headline="Security">
        While we make reasonable efforts to protect your information, no
        electronic storage can be entirely secure.
      </Paragraph>
      <Paragraph headline="International Availability">
        Services are hosted in the European Union. If you choose to use my
        Services from the European Union or other regions of the world with laws
        governing data collection and use that may differ from EU law, then
        please note that you are transferring your personal information outside
        of those regions to the EU for storage and processing. Also, I may
        transfer your data from the EU to other countries or regions in
        connection with the storage and processing of data, fulfilling your
        requests, and operating my Services. By providing any information,
        including personal information, on or to my Services, you consent to
        such transfer, storage, and processing.
      </Paragraph>
      <Paragraph headline="Registration and Account Information">
        When you register to use my Services, I may ask you for personal
        information to create your account, such as your name, email address,
        and password. If you sign up using a third-party account, such as Google
        or Facebook, I will also receive information from third-party services,
        including your name and email address.
      </Paragraph>

      <Paragraph headline="Contact">
        For any questions, comments, or concerns about our processing
        activities, please get <a href="/about">in contact</a>.
      </Paragraph>
    </Article>
  );
}
